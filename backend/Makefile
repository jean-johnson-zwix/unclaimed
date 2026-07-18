SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
.SUFFIXES:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

PROJECT := unclaimed
PORT ?= 8000

.PHONY: all sync run test lint graph clean help

## Default: sync deps
all: sync

## Sync dependencies
sync:
	uv sync

## Run the server
run:
	uv run uvicorn app.main:app --host 0.0.0.0 --port $(PORT)

## Run tests
test:
	uv run pytest tests/ -v

## Lint with ruff (if installed)
lint:
	uv run ruff check app/ tests/ || true

## Generate interactive graph visualization (graph.html)
graph:
	uv run python scripts/visualize.py

## Remove cached files
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache

## Show help
help:
	@echo "$(PROJECT) backend"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""
	@echo "Usage: make [target] [PORT=8000]"
