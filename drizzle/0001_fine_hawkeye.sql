CREATE TABLE `episode_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_item_id` integer NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`watched_at` text NOT NULL,
	FOREIGN KEY (`library_item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_progress_unique` ON `episode_progress` (`library_item_id`,`season_number`,`episode_number`);