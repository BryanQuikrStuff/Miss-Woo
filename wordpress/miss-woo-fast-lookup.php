<?php
/**
 * Plugin Name: Miss-Woo fast order lookup
 * Description: Read-only REST endpoint used by the Miss-Woo Missive sidebar (via the Cloudflare middleman). One request returns a customer's recent orders with their notes, replacing three slower WooCommerce API calls.
 * Version: 1.0.0
 *
 * INSTALL (admin with server/file access):
 *   Upload this file to  wp-content/mu-plugins/miss-woo-fast-lookup.php
 *   ("must-use" plugins load automatically; nothing to activate, and it does not
 *   appear in the normal Plugins list, so it can't be switched off by accident).
 *
 * ENDPOINT:
 *   GET /wp-json/wc-quikrstuff/v1/orders-by-email?email=a@x.com,b@y.com&statuses=processing,completed,pending&limit=10
 *
 * SECURITY:
 *   - Read-only: it only reads orders and order notes.
 *   - Answers only requests authenticated with a WooCommerce REST API key whose
 *     user can read shop orders (the same Read-only key the middleman already uses).
 *     Everyone else gets "rest_forbidden".
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', function () {
	register_rest_route( 'wc-quikrstuff/v1', '/orders-by-email', array(
		'methods'             => 'GET',
		'callback'            => 'quikrstuff_fast_orders_by_email',
		'permission_callback' => function () {
			return current_user_can( 'read_private_shop_orders' );
		},
		'args'                => array(
			'email'    => array( 'required' => true ),
			'statuses' => array( 'default' => 'processing,completed,pending' ),
			'limit'    => array( 'default' => 10, 'sanitize_callback' => 'absint' ),
		),
	) );
} );

function quikrstuff_fast_orders_by_email( WP_REST_Request $request ) {
	if ( ! function_exists( 'wc_get_orders' ) || ! class_exists( 'WC_REST_Orders_Controller' ) ) {
		return new WP_Error( 'woocommerce_missing', 'WooCommerce is not active.', array( 'status' => 500 ) );
	}

	// Up to 4 valid, lower-cased email addresses.
	$emails = array();
	foreach ( explode( ',', (string) $request->get_param( 'email' ) ) as $raw ) {
		$email = strtolower( sanitize_email( trim( $raw ) ) );
		if ( $email && is_email( $email ) && ! in_array( $email, $emails, true ) ) {
			$emails[] = $email;
		}
	}
	$emails = array_slice( $emails, 0, 4 );
	if ( empty( $emails ) ) {
		return new WP_Error( 'bad_request', 'A valid email is required.', array( 'status' => 400 ) );
	}

	// Allowed statuses, e.g. processing,completed,pending -> wc-processing, ...
	$statuses = array();
	foreach ( explode( ',', (string) $request->get_param( 'statuses' ) ) as $raw ) {
		$status = sanitize_key( preg_replace( '/^wc-/', '', trim( $raw ) ) );
		if ( $status ) {
			$statuses[] = 'wc-' . $status;
		}
	}
	if ( empty( $statuses ) ) {
		$statuses = array( 'wc-processing', 'wc-completed', 'wc-pending' );
	}

	$limit = min( max( (int) $request->get_param( 'limit' ), 1 ), 20 );
	$base  = array(
		'limit'   => $limit,
		'orderby' => 'date',
		'order'   => 'DESC',
		'type'    => 'shop_order',
		'status'  => $statuses,
	);

	// Orders placed by each customer account, plus orders whose billing email matches.
	$found        = array();
	$customer_ids = array();
	foreach ( $emails as $email ) {
		$user = get_user_by( 'email', $email );
		if ( $user ) {
			$customer_ids[] = (int) $user->ID;
			foreach ( wc_get_orders( $base + array( 'customer_id' => (int) $user->ID ) ) as $order ) {
				$found[ $order->get_id() ] = $order;
			}
		}
		foreach ( wc_get_orders( $base + array( 'billing_email' => $email ) ) as $order ) {
			$found[ $order->get_id() ] = $order;
		}
	}

	// Newest first, capped.
	uasort( $found, function ( $a, $b ) {
		$da = $a->get_date_created() ? $a->get_date_created()->getTimestamp() : 0;
		$db = $b->get_date_created() ? $b->get_date_created()->getTimestamp() : 0;
		return $db <=> $da;
	} );
	$found = array_slice( $found, 0, $limit, true );

	// Same order format as /wc/v3/orders, with the order notes attached.
	$controller = new WC_REST_Orders_Controller();
	$orders     = array();
	foreach ( $found as $order ) {
		$item          = $controller->prepare_response_for_collection(
			$controller->prepare_object_for_response( $order, $request )
		);
		$item['notes'] = array();
		foreach ( wc_get_order_notes( array( 'order_id' => $order->get_id() ) ) as $note ) {
			$item['notes'][] = array(
				'id'            => (int) $note->id,
				'author'        => $note->added_by,
				'date_created'  => wc_rest_prepare_date_response( $note->date_created ),
				'note'          => $note->content,
				'customer_note' => (bool) $note->customer_note,
			);
		}
		$orders[] = $item;
	}

	return rest_ensure_response( array(
		'emails'       => $emails,
		'customer_ids' => array_values( array_unique( $customer_ids ) ),
		'orders'       => $orders,
	) );
}
