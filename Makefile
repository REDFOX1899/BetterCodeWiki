## ============================================================
## GitUnderstand — Development & Operations Makefile
## ============================================================
## Run `make help` to see all available targets.
## ============================================================

.PHONY: dev dev-api dev-web test test-api lint build-api build-web \
        push-api push-web deploy-api deploy-web deploy \
        infra-plan infra-apply ingest ingest-batch ingest-batch-skip \
        ingest-dry-run spec help

## ------ Development ------------------------------------------

dev: ## Start frontend + backend via Docker Compose
	docker compose -f docker/docker-compose.yml up

dev-api: ## Start the FastAPI backend locally (port 8001)
	cd api && poetry run python -m api.main

dev-web: ## Start the Next.js frontend locally (port 3000)
	yarn dev

## ------ Testing & Linting ------------------------------------

test: ## Run all tests (pytest + eslint)
	pytest test/ && yarn lint

test-api: ## Run backend Python tests only
	pytest test/

lint: ## Run frontend linter (eslint)
	yarn lint

## ------ Docker Builds ----------------------------------------

build-api: ## Build the backend Docker image
	docker build -f docker/Dockerfile.backend -t gitunderstand-api .

build-web: ## Build the frontend Docker image
	docker build -f docker/Dockerfile.frontend -t gitunderstand-web .

## ------ Docker Push (to Artifact Registry) ---------------------

push-api: build-api ## Build & push API image to GAR
	docker tag gitunderstand-api us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/api:latest
	docker push us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/api:latest

push-web: build-web ## Build & push Web image to GAR
	docker tag gitunderstand-web us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/web:latest
	docker push us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/web:latest

## ------ Deploy (manual gcloud) ---------------------------------

deploy-api: ## Deploy API to Cloud Run (uses latest GAR image)
	gcloud run deploy gitunderstand-api \
		--image us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/api:latest \
		--region us-central1 \
		--platform managed \
		--allow-unauthenticated \
		--service-account runtime-sa@gitunderstand.iam.gserviceaccount.com \
		--port 8001 \
		--cpu 1 --memory 2Gi \
		--min-instances 0 --max-instances 3 \
		--set-env-vars "ENVIRONMENT=production,WIKI_STORAGE_BACKEND=gcs,GCS_BUCKET_NAME=gitunderstand-wikicache" \
		--set-secrets "GOOGLE_API_KEY=google-api-key:latest,OPENAI_API_KEY=openai-api-key:latest,CLERK_SECRET_KEY=clerk-secret-key:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest"

deploy-web: ## Deploy Web to Cloud Run (uses latest GAR image)
	gcloud run deploy gitunderstand-web \
		--image us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/web:latest \
		--region us-central1 \
		--platform managed \
		--allow-unauthenticated \
		--service-account runtime-sa@gitunderstand.iam.gserviceaccount.com \
		--port 3000 \
		--cpu 1 --memory 512Mi \
		--min-instances 0 --max-instances 5 \
		--set-env-vars "ENVIRONMENT=production,NODE_ENV=production"

deploy: deploy-api deploy-web ## Deploy both services to Cloud Run

## ------ Infrastructure (Terraform) ---------------------------

infra-plan: ## Preview Terraform changes for production
	cd infra/environments/prod && terraform plan

infra-apply: ## Apply Terraform changes to production
	cd infra/environments/prod && terraform apply

## ------ Ingestion -----------------------------------------------

ingest: ## Ingest a single repo (usage: make ingest REPO=facebook/react TAGS=javascript,ui)
	python scripts/ingest.py --repo $(REPO) $(if $(TAGS),--tags $(TAGS),) $(if $(PROVIDER),--provider $(PROVIDER),)

ingest-batch: ## Ingest all repos from repos.json
	python scripts/ingest_batch.py --repos scripts/repos.json

ingest-batch-skip: ## Ingest repos, skipping existing ones
	python scripts/ingest_batch.py --repos scripts/repos.json --skip-existing

ingest-dry-run: ## Preview what repos would be ingested
	python scripts/ingest_batch.py --repos scripts/repos.json --dry-run

## ------ Utilities --------------------------------------------

spec: ## Create a new feature spec from template (usage: make spec NAME=my-feature)
	cp specs/_template.md specs/$(NAME).md && echo "Created specs/$(NAME).md"

## ------ Help -------------------------------------------------

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
