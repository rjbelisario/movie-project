CREATE TABLE `trakt_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`trakt_username` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_synced_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
