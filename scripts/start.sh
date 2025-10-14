#!/usr/bin/env bash
set -euo pipefail

# Configuration
# shellcheck disable=SC2155
readonly SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
# shellcheck disable=SC2155
readonly ROOT_DIR="$(dirname "$SCRIPT_DIR")"
readonly LOG_PREFIX="[start.sh]"
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
#readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
   echo -e "${BLUE}${LOG_PREFIX} INFO:${NC} $*" >&2
}

log_error() {
   echo -e "${RED}${LOG_PREFIX} ERROR:${NC} $*" >&2
}

log_warn() {
   echo -e "${YELLOW}${LOG_PREFIX} WARN:${NC} $*" >&2
}

# Change to root directory
cd "$ROOT_DIR" || {
    log_error "Failed to change to root directory: $ROOT_DIR"
    exit 1
}

# Test if we can write to current directory
can_write_to_directory() {
    local test_file
    test_file=$(mktemp -p . .write_test.XXXXXX 2>/dev/null) && {
        rm -f "$test_file"
        return 0
    }
    return 1
}

# Fix directory ownership for container environments
fix_directory_ownership() {
    target_dir="/home/waldiez/workspace"
    log_info "Fixing ownership of ${target_dir} for user $(whoami) ($(id -u))"
    if [[ "$(id -u)" -eq 0 ]]; then
        chown -R "$(id -u)" "${target_dir}"
    else
        sudo chown -R "$(id -u)" "${target_dir}" 2>/dev/null || {
            log_warn "Could not fix ownership - sudo not available or permission denied"
            return 1
        }
    fi
    cd "${target_dir}" || return 1
}

# Handle directory permissions
setup_directory_permissions() {
    if ! can_write_to_directory; then
        log_warn "Cannot write to current directory, attempting to fix permissions"
        if ! fix_directory_ownership; then
            log_error "Failed to fix directory permissions"
            exit 1
        fi

        # Test again after fixing
        if ! can_write_to_directory; then
            log_error "Still cannot write to directory after permission fix"
            exit 1
        fi
        log_info "Directory permissions fixed successfully"
    fi
}

# Set up environment
setup_environment() {
    export SHELL=/bin/bash
    export TERM=xterm-256color
    export PYTHONUNBUFFERED=1
}

# Cleanup function for graceful shutdown
cleanup() {
    log_info "Received shutdown signal, cleaning up..."
    # Add any cleanup tasks here
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Main execution
main() {
    log_info "Starting Waldiez Studio ..."
    setup_directory_permissions
    setup_environment
    waldiez-studio
}

# Run main function
main "$@"
