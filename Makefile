## ============================================================
## GitUnderstand — Development & Operations Makefile
## ============================================================
## Run `make help` to see all available targets.
## ============================================================

.PHONY: dev dev-api dev-web test test-api lint build-api build-web \
        infra-plan infra-apply ingest spec help

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

## ------ Infrastructure (Terraform) ---------------------------

infra-plan: ## Preview Terraform changes for production
	cd infra/environments/prod && terraform plan

infra-apply: ## Apply Terraform changes to production
	cd infra/environments/prod && terraform apply

## ------ Utilities --------------------------------------------

ingest: ## Ingest a repo into the wiki cache (usage: make ingest REPO=owner/repo)
	python scripts/ingest.py --repo $(REPO)

spec: ## Create a new feature spec from template (usage: make spec NAME=my-feature)
	cp specs/_template.md specs/$(NAME).md && echo "Created specs/$(NAME).md"

## ------ Help -------------------------------------------------

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
