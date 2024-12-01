.DEFAULT_GOAL := help

.TESTS_DIR := tests
.REPORTS_DIR := reports
.PACKAGE_NAME := waldiez_studio

.PHONY: help
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Default target: help"
	@echo ""
	@echo "Targets:"
	@echo " help             Show this message and exit"
	@echo " format           Format the code"
	@echo " lint             Lint the code"
	@echo " forlint          Alias for 'make format && make lint'"
	@echo " requirements	 Generate requirements/*.txt files"
	@echo " test             Run the tests"
	@echo " clean            Remove unneeded files (__pycache__, .mypy_cache, etc.)"
	@echo " build            Build the python package"
	@echo " dev              Generate (and install) requirements, lint, test"
	@echo ""

.PHONY: format
format:
	isort .
	autoflake --remove-all-unused-imports --remove-unused-variables --in-place .
	black --config pyproject.toml .
	ruff format --config pyproject.toml .

.PHONY: lint
lint:
	isort --check-only .
	black --check --config pyproject.toml .
	mypy --config pyproject.toml .
	flake8 --config=.flake8
	pydocstyle --config pyproject.toml .
	bandit -r -c pyproject.toml .
	yamllint -c .yamllint.yaml .
	ruff check --config pyproject.toml .
	pylint --rcfile=pyproject.toml .
	python scripts/eclint.py

.PHONY: forlint
forlint: format lint

.PHONY: clean
clean:
	python scripts/clean.py

.PHONY: export
export:
	python scripts/export.py

.PHONY: requirements
requirements:
	python scripts/requirements.py

.PHONY: .before_test
.before_test:
	python -c 'import os; os.makedirs("${.REPORTS_DIR}", exist_ok=True)'
	python -c \
		'import subprocess, sys; subprocess.run(\
		[sys.executable, "-m", "pip", "uninstall", "-y", "${.PACKAGE_NAME}"], \
		stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)'

.PHONY: test
test: .before_test
	python -m pytest \
		-c pyproject.toml \
		--cov=${.PACKAGE_NAME} \
		--cov-report=term-missing:skip-covered \
		--cov-report html:${.REPORTS_DIR}/html \
		--cov-report xml:${.REPORTS_DIR}/coverage.xml \
		--cov-report lcov:${.REPORTS_DIR}/lcov.info \
		--junitxml=${.REPORTS_DIR}/xunit.xml \
		${.TESTS_DIR}/

.PHONY: build
build:
	python -c 'import os; os.makedirs("dist", exist_ok=True); os.makedirs("build", exist_ok=True)'
	python -c 'import shutil; shutil.rmtree("dist", ignore_errors=True); shutil.rmtree("build", ignore_errors=True)'
	python -m pip install --upgrade pip wheel
	python -m pip install -r requirements/main.txt
	python -m pip install build twine
	python -m build --sdist --wheel --outdir dist/
	python -m twine check dist/*.whl
	python -c 'import shutil; shutil.rmtree("build", ignore_errors=True)'

.PHONY: dev
dev: clean requirements
	python -m pip install -r requirements/all.txt
	make forlint
	make test
