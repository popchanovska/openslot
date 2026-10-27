CREATE TYPE "public"."booking_focus" AS ENUM('CUSTOM_AGENT', 'AUTOMATE_WORKFLOW', 'PROMPTING', 'OTHER');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"guest_name" text NOT NULL,
	"guest_email" text NOT NULL,
	"focus" "booking_focus" NOT NULL,
	"goal_note" text DEFAULT '' NOT NULL,
	"confirmation_message" text,
	"prep_checklist" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_slot_id_unique" UNIQUE("slot_id")
);
--> statement-breakpoint
CREATE TABLE "google_connection" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"scope" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	CONSTRAINT "google_connection_single_row" CHECK ("google_connection"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "host_profile" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"bio" text NOT NULL,
	"session_minutes" integer DEFAULT 30 NOT NULL,
	"location" text NOT NULL,
	CONSTRAINT "host_profile_single_row" CHECK ("host_profile"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slots_end_after_start" CHECK ("slots"."end_at" > "slots"."start_at")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slots_start_at_idx" ON "slots" USING btree ("start_at");