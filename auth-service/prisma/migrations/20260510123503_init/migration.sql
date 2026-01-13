-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GITHUB');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPERVISOR', 'ADMIN');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "provider_id" TEXT NOT NULL,
    "provider_login" TEXT,
    "profile_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_organizations" (
    "id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "external_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supervisor_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_pool_members" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_pool_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_provider_provider_login_idx" ON "accounts"("provider", "provider_login");

-- CreateIndex
CREATE INDEX "accounts_profile_url_idx" ON "accounts"("profile_url");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_id_key" ON "accounts"("provider", "provider_id");

-- CreateIndex
CREATE INDEX "supervisor_organizations_provider_external_id_idx" ON "supervisor_organizations"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_organizations_supervisor_id_provider_external_id_key" ON "supervisor_organizations"("supervisor_id", "provider", "external_id");

-- CreateIndex
CREATE INDEX "supervisor_pool_members_member_id_idx" ON "supervisor_pool_members"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_pool_members_owner_id_member_id_key" ON "supervisor_pool_members"("owner_id", "member_id");

-- AddForeignKey
ALTER TABLE "supervisor_organizations" ADD CONSTRAINT "supervisor_organizations_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_pool_members" ADD CONSTRAINT "supervisor_pool_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_pool_members" ADD CONSTRAINT "supervisor_pool_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
