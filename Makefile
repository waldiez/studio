.DEFAULT_GOAL := help

.TESTS_DIR := tests
.REPORTS_DIR := coverage
.PACKAGE_NAME := waldiez_studio
.PACKAGE_MANAGER := bun

ifeq ($(OS),Windows_NT)
  PYTHON_PATH := $(shell where python 2>NUL || where py 2>NUL)
else
  PYTHON_PATH := $(shell command -v python || command -v python3)
endif

PYTHON_NAME := $(notdir $(lastword $(PYTHON_PATH)))
PYTHON := $(basename $(PYTHON_NAME))


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
	@echo " requirements     Generate requirements/*.txt files"
	@echo " test-back        Run the tests for the backend"
	@echo " test-front       Run the tests for the frontend"
	@echo " test             Run the tests"
	@echo " clean-back       Remove unneeded files (__pycache__, .mypy_cache, etc.)"
	@echo " clean-front      Remove unneeded files (.stylelintcache, etc.)"
	@echo " clean            Remove unneeded files"
	@echo " build-back       Build the python package"
	@echo " build-front      Build the frontend package"
	@echo " build            Build the packages"
	@echo " image            Build the podman/docker image"
	@echo " some-back        Run format, lint, test and build for the backend"
	@echo " some-front       Run format, lint, test and build for the frontend"
	@echo " some             Run format, lint, test and build"
	@echo " dev-back         Run the development server"
	@echo " dev-front        Run the development server for the frontend"
	@echo " dev              Run the development server for the backend and frontend"
	@echo ""

.PHONY: format-back
format-back:
	isort .
	autoflake --remove-all-unused-imports --remove-unused-variables --in-place .
	black --config pyproject.toml .
	ruff format --config pyproject.toml .

.PHONY: format-front
format-front:
	${.PACKAGE_MANAGER} run format

.PHONY: format
format: format-back format-front

.PHONY: lint-back
lint-back:
	isort --check-only .
	black --check --config pyproject.toml .
	mypy --config pyproject.toml .
	$(PYTHON) scripts/lint.py --pyright
	flake8 --config=.flake8
	pydocstyle --config pyproject.toml .
	bandit -r -c pyproject.toml .
	yamllint -c .yamllint.yaml .
	ruff check --config pyproject.toml .
	pylint --rcfile=pyproject.toml .

.PHONY: lint-front
lint-front:
	${.PACKAGE_MANAGER} run lint

.PHONY: lint
lint: lint-back lint-front

.PHONY: forlint
forlint: format lint

.PHONY: clean-back
clean-back:
	$(PYTHON) scripts/clean.py

.PHONY: clean-front
clean-front:
	${.PACKAGE_MANAGER} run clean

.PHONY: clean
clean: clean-back clean-front

.PHONY: requirements-back
requirements-back:
	$(PYTHON) scripts/requirements.py

.PHONY: requirements
requirements: requirements-back

.PHONY: requirements-front
requirements-front:
	${.PACKAGE_MANAGER} run requirements

.PHONY: .before_test
.before_test:
	$(PYTHON) -c 'import os; os.makedirs(os.path.join("${.REPORTS_DIR}", "backend"), exist_ok=True)'
	$(PYTHON) -c \
		'import subprocess, sys; subprocess.run(\
		[sys.executable, "-m", "pip", "uninstall", "-y", "${.PACKAGE_NAME}"], \
		stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)'

.PHONY: test-back
test-back: .before_test
	$(PYTHON) scripts/test.py

.PHONY: test-front
test-front:
	${.PACKAGE_MANAGER} run test:front

.PHONY: test
test: test-front test-back

.PHONY: build-front
build-front:
	${.PACKAGE_MANAGER} run build

.PHONY: build-back
build-back:
	$(PYTHON) scripts/build.py

.PHONY: image
image:
	$(PYTHON) scripts/image.py

.PHONY: dev-image-no-cache
dev-image-no-cache:
	$(PYTHON) scripts/image.py --dev --no-cache

.PHONY: dev-image
dev-image:
	$(PYTHON) scripts/image.py --dev --no-cache

.PHONY: dev-dev-image
dev-dev-image:
	$(PYTHON) scripts/image.py --dev --build-args REACT_BRANCH=dev --build-args PYTHON_BRANCH=dev


.PHONY: dev-dev-image-no-cache
dev-dev-image-no-cache:
	$(PYTHON) scripts/image.py --dev --no-cache --build-args REACT_BRANCH=dev --build-args PYTHON_BRANCH=dev


.PHONY: build
build: build-front build-back

.PHONY: some-back
some-back: clean-back format-back lint-back test-back build-back

.PHONY: some-front
some-front: clean-front format-front lint-front test-front build-front

.PHONY: some
some: some-front some-back

.PHONY: dev-back
dev-back:
	$(PYTHON) -m waldiez_studio --reload --log-level debug

.PHONY: dev-front
dev-front:
	${.PACKAGE_MANAGER} run dev:front

.PHONY: dev
dev:
	${.PACKAGE_MANAGER} run dev
