.PHONY: dev-build dev-run dev-kill

dev-build:
	docker compose build

dev-run:
	docker compose up

dev-kill:
	docker compose down
