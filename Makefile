.DEFAULT_GOAL := help

.TESTS_DIR := tests
.REPORTS_DIR := coverage
.PACKAGE_NAME := waldiez_studio

.PHONY: help
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Default target: help"
	@echo ""
	@echo "Targets:"
	@echo " help             Show this message and exit"
	@echo " format-back      Format the python code"
	@echo " format-front     Format the frontend code"
	@echo " format           Format the code"
	@echo " lint-back        Lint the python code"
	@echo " lint-front       Lint the frontend code"
	@echo " lint             Lint the code"
	@echo " forlint          Alias for 'make format && make lint'"
	@echo " requirements	 Generate requirements/*.txt files"
	@echo " test-back        Run the tests for the backend"
	@echo " test-front       Run the tests for the frontend"
	@echo " test             Run the tests"
	@echo " clean-back       Remove unneeded files (__pycache__, .mypy_cache, etc.)"
	@echo " clean-front      Remove unneeded files (.stylelintcache, etc.)"
	@echo " clean            Remove unneeded files"
	@echo " build-back       Build the python package"
	@echo " build-front      Build the frontend package"
	@echo " build            Build the packages"
	@echo " image            Build the docker/podman image"
	@echo " all-back         Run format, lint, test and build for the backend"
	@echo " all-front        Run format, lint, test and build for the frontend"
	@echo " all              Run format, lint, test and build"
	@echo " dev-back         Run the development server"
	@echo " dev-front        Run the development server for the frontend"
	@echo " dev          	 Run the development server for the backend and frontend"
	@echo ""

.PHONY: format-back
format-back:
	isort .
	autoflake --remove-all-unused-imports --remove-unused-variables --in-place .
	black --config pyproject.toml .
	ruff format --config pyproject.toml .

.PHONY: format-front
format-front:
	yarn format:front

.PHONY: format
format: format-back format-front

.PHONY: lint-back
lint-back:
	isort --check-only .
	black --check --config pyproject.toml .
	mypy --config pyproject.toml .
	flake8 --config=.flake8
	pydocstyle --config pyproject.toml .
	bandit -r -c pyproject.toml .
	yamllint -c .yamllint.yaml .
	ruff check --config pyproject.toml .
	pylint --rcfile=pyproject.toml .

.PHONY: lint-front
lint-front:
	yarn lint:front

.PHONY: lint
lint: lint-back lint-front

.PHONY: forlint
forlint: format lint

.PHONY: clean-back
clean-back:
	python scripts/clean.py

.PHONY: clean-front
clean-front:
	yarn clean:front

.PHONY: clean
clean: clean-back clean-front

.PHONY: requirements-back
requirements-back:
	python scripts/requirements.py

.PHONY: requirements-front
requirements-front:
	yarn requirements:front

.PHONY: .before_test
.before_test:
	python -c 'import os; os.makedirs(os.path.join("${.REPORTS_DIR}", "backend"), exist_ok=True)'
	python -c \
		'import subprocess, sys; subprocess.run(\
		[sys.executable, "-m", "pip", "uninstall", "-y", "${.PACKAGE_NAME}"], \
		stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)'

.PHONY: test-back
test-back: .before_test
	python -m pytest \
		-c pyproject.toml \
		--cov=${.PACKAGE_NAME} \
		--cov-branch \
		--cov-report=term-missing:skip-covered \
		--cov-report html:${.REPORTS_DIR}/backend/html \
		--cov-report xml:${.REPORTS_DIR}/backend/coverage.xml \
		--cov-report lcov:${.REPORTS_DIR}/backend/lcov.info \
		--junitxml=${.REPORTS_DIR}/backend/xunit.xml \
		${.TESTS_DIR}/

.PHONY: test-front
test-front:
	yarn test:front

.PHONY: test
test: test-front test-back
	yarn lcov:merge

.PHONY: build-front
build-front:
	yarn build:front

.PHONY: build-back
build-back:
	python scripts/build.py

.PHONY: build
build: build-front build-back

.PHONY: image
image:
	python scripts/image.py

.PHONY: all-back
all-back: clean-back format-back lint-back test-back build-back

.PHONY: all-front
all-front: clean-front format-front lint-front test-front build-front

.PHONY: all
all: clean format lint test build image

.PHONY: dev-back
dev-back:
	python -m waldiez_studio --reload --log-level debug

.PHONY: dev-front
dev-front:
	yarn dev:front

.PHONY: dev
dev:
	yarn dev
