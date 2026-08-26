CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"note" text,
	"status" "recommendation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "recommendations_no_self_ck" CHECK ("recommendations"."from_user_id" <> "recommendations"."to_user_id")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "suggested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_triple_uq" ON "recommendations" USING btree ("from_user_id","to_user_id","title_id");--> statement-breakpoint
CREATE INDEX "recommendations_inbox_idx" ON "recommendations" USING btree ("to_user_id","status");--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_suggested_by_user_id_users_id_fk" FOREIGN KEY ("suggested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;