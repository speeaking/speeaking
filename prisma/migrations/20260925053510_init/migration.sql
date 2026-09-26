-- CreateEnum
CREATE TYPE "UserGoal" AS ENUM ('ENTERTAINMENT', 'DISCOVER', 'BUY_SOMETHING', 'SELL', 'CREATE_CONTENT', 'LEARN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'TRANSFER', 'CASH_ON_DELIVERY', 'OXXO');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY_NOTICE', 'PERSONALIZATION');

-- CreateEnum
CREATE TYPE "InterestKind" AS ENUM ('BRAND', 'TOPIC');

-- CreateEnum
CREATE TYPE "IntentSource" AS ENUM ('ONBOARDING', 'SEARCH', 'AI_COMPANION');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('POST', 'VIDEO', 'PRODUCT');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'LIKE_NEW', 'USED_GOOD', 'USED_FAIR', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "WarrantyType" AS ENUM ('NONE', 'SELLER', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "Authenticity" AS ENUM ('NOT_APPLICABLE', 'DECLARED_ORIGINAL', 'GENERIC');

-- CreateEnum
CREATE TYPE "AIFeature" AS ENUM ('SALE_PROPOSAL', 'CONTENT_GENERATION', 'CAMPAIGN_STRATEGY', 'PLATFORM_ANALYSIS');

-- CreateEnum
CREATE TYPE "AIRequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'BLOCKED_BUDGET');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('IMPRESSION', 'VIEW', 'CLICK', 'SEARCH', 'LIKE', 'UNLIKE', 'SAVE', 'UNSAVE', 'COMMENT', 'FOLLOW', 'SHARE', 'NOT_INTERESTED', 'COMMUNITY_JOIN', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'PURCHASE', 'SIGN_UP', 'ONBOARDING_COMPLETED', 'AI_PROPOSAL_GENERATED', 'AI_PROPOSAL_ACCEPTED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('POST', 'PRODUCT', 'PROFILE', 'COMMUNITY', 'CATEGORY');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('FEED', 'COMMUNITY', 'DISCOVER', 'SHOP', 'PROFILE', 'PRODUCT_PAGE', 'POST_PAGE', 'SHARE_LINK', 'STUDIO', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "Actor" AS ENUM ('AI', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "city" TEXT,
    "state" TEXT,
    "goals" "UserGoal"[] DEFAULT ARRAY[]::"UserGoal"[],
    "personalizationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isEditorial" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT,
    "state" TEXT,
    "acceptedPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[],
    "status" "SellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "InterestKind" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_intents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "categoryId" UUID,
    "budgetMaxCents" INTEGER,
    "source" "IntentSource" NOT NULL DEFAULT 'ONBOARDING',
    "status" "IntentStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "hue" INTEGER NOT NULL DEFAULT 12,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_memberships" (
    "userId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_memberships_pkey" PRIMARY KEY ("userId","communityId")
);

-- CreateTable
CREATE TABLE "community_categories" (
    "communityId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "community_categories_pkey" PRIMARY KEY ("communityId","categoryId")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "blurDataUrl" TEXT,
    "altText" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "communityId" UUID,
    "type" "PostType" NOT NULL DEFAULT 'POST',
    "body" TEXT NOT NULL,
    "productId" UUID,
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "postId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("postId","mediaId")
);

-- CreateTable
CREATE TABLE "likes" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "saved_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID,
    "productId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "compareAtPriceCents" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
    "categoryId" UUID NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pickupAvailable" BOOLEAN NOT NULL DEFAULT false,
    "localDeliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "localDeliveryZones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nationalShippingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "shippingPriceCents" INTEGER,
    "deliveryMinDays" INTEGER,
    "deliveryMaxDays" INTEGER,
    "warrantyType" "WarrantyType" NOT NULL DEFAULT 'NONE',
    "warrantyDays" INTEGER,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 0,
    "authenticity" "Authenticity" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_costs" (
    "productId" UUID NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_costs_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "product_media" (
    "productId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("productId","mediaId")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "feature" "AIFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" "AIRequestStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_responses" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "output" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicrosUsd" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "userId" UUID,
    "anonymousId" TEXT,
    "entityType" "EntityType",
    "entityId" UUID,
    "sourcePostId" UUID,
    "surface" "Surface",
    "position" INTEGER,
    "score" DOUBLE PRECISION,
    "algorithmVersion" TEXT,
    "query" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" "Actor" NOT NULL DEFAULT 'SYSTEM',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "platform_decisions" (
    "id" UUID NOT NULL,
    "actor" "Actor" NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "settingKey" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "riskLevel" "RiskLevel" NOT NULL,
    "status" "DecisionStatus" NOT NULL DEFAULT 'PROPOSED',
    "expectedImpact" TEXT,
    "measuredImpact" JSONB,
    "decidedAt" TIMESTAMPTZ(3),
    "appliedAt" TIMESTAMPTZ(3),
    "revertedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_userId_key" ON "seller_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_consents_userId_type_createdAt_idx" ON "user_consents"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_interests_userId_kind_value_key" ON "user_interests"("userId", "kind", "value");

-- CreateIndex
CREATE INDEX "shopping_intents_userId_status_idx" ON "shopping_intents"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE INDEX "community_memberships_communityId_idx" ON "community_memberships"("communityId");

-- CreateIndex
CREATE INDEX "community_categories_categoryId_idx" ON "community_categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "media_storageKey_key" ON "media"("storageKey");

-- CreateIndex
CREATE INDEX "media_ownerId_createdAt_idx" ON "media"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_status_publishedAt_id_idx" ON "posts"("status", "publishedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "posts_communityId_status_publishedAt_idx" ON "posts"("communityId", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "posts_authorId_publishedAt_idx" ON "posts"("authorId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "posts_productId_idx" ON "posts"("productId");

-- CreateIndex
CREATE INDEX "post_media_mediaId_idx" ON "post_media"("mediaId");

-- CreateIndex
CREATE INDEX "likes_postId_idx" ON "likes"("postId");

-- CreateIndex
CREATE INDEX "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- CreateIndex
CREATE INDEX "saved_items_userId_createdAt_idx" ON "saved_items"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_userId_postId_key" ON "saved_items"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_userId_productId_key" ON "saved_items"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_categoryId_createdAt_idx" ON "products"("status", "categoryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "products_sellerId_status_idx" ON "products"("sellerId", "status");

-- CreateIndex
CREATE INDEX "product_media_mediaId_idx" ON "product_media"("mediaId");

-- CreateIndex
CREATE INDEX "ai_requests_userId_createdAt_idx" ON "ai_requests"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_requests_feature_createdAt_idx" ON "ai_requests"("feature", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_responses_requestId_key" ON "ai_responses"("requestId");

-- CreateIndex
CREATE INDEX "analytics_events_type_createdAt_idx" ON "analytics_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_entityType_entityId_createdAt_idx" ON "analytics_events"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_createdAt_idx" ON "analytics_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_sourcePostId_idx" ON "analytics_events"("sourcePostId");

-- CreateIndex
CREATE INDEX "platform_decisions_status_createdAt_idx" ON "platform_decisions"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_intents" ADD CONSTRAINT "shopping_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_intents" ADD CONSTRAINT "shopping_intents_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_categories" ADD CONSTRAINT "community_categories_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_categories" ADD CONSTRAINT "community_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ai_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un guardado apunta exactamente a una publicación o a un producto (docs/data-model.md).
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_exactly_one_target"
  CHECK (num_nonnulls("postId", "productId") = 1);

-- Integridad de montos y contadores (dinero en centavos, P2).
ALTER TABLE "products" ADD CONSTRAINT "products_price_non_negative" CHECK ("priceCents" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("stock" >= 0);
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_non_negative" CHECK ("unitCostCents" >= 0);
ALTER TABLE "posts" ADD CONSTRAINT "posts_counters_non_negative"
  CHECK ("likeCount" >= 0 AND "commentCount" >= 0 AND "saveCount" >= 0);
