#!/bin/bash
# =============================================================================
# {STORY-ID}: {Story Title} (endpoint test)
# =============================================================================
# AC tested: AC1, AC2, AC3...
# Prerequisites: Docker running, jq installed
# Usage: ./test-{feature}.sh
# =============================================================================

set -e
THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$THIS_DIR/../config.sh"

check_jq
check_api
setup_auth  # If auth required

# Directories
RESULTS_DIR="$THIS_DIR/../results"
EXPECTED_DIR="$THIS_DIR/expected"
mkdir -p "$RESULTS_DIR"

# Timing
START_TIME=$(date +%s)
echo "Started at $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Test counters
TOTAL=0
PASSED=0
FAILED=0
declare -a TEST_NAMES
declare -a TEST_DURATIONS
declare -a TEST_STATUSES

# =============================================================================
# Helpers
# =============================================================================
call_endpoint() {
    local endpoint=$1
    shift
    curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$@"
}

run_test() {
    local name="$1" func="$2"
    ((++TOTAL))

    local test_start=$(date +%s)
    echo ""
    echo "=========================================="
    echo "TEST $TOTAL: $name"
    echo "=========================================="

    if $func; then
        ((++PASSED))
        TEST_STATUSES+=("PASS")
        print_status "PASS" "$name"
    else
        ((++FAILED))
        TEST_STATUSES+=("FAIL")
        print_status "FAIL" "$name"
    fi

    local test_end=$(date +%s)
    local duration=$((test_end - test_start))
    TEST_NAMES+=("$name")
    TEST_DURATIONS+=("$duration")

    sleep 1
}

# =============================================================================
# AC1: Description
# =============================================================================
test_ac1_description() {
    local full_response=$(call_endpoint "/v1/some-endpoint" -X POST \
        -H "Content-Type: application/json" \
        -d '{"key": "value"}')

    local http_code=$(echo "$full_response" | tail -1)
    local response=$(echo "$full_response" | sed '$d')

    # Strict validation: HTTP code
    if [ "$http_code" != "200" ]; then
        print_status "FAIL" "Expected HTTP 200, got $http_code"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 1
    fi

    # Save response for inspection
    echo "$response" > "$RESULTS_DIR/response_ac1.json"

    # Expected-based validation (PRIMARY) OR field validation
    local field=$(echo "$response" | jq -r '.field_name // empty')
    [ -z "$field" ] && { print_status "FAIL" "Missing field_name"; return 1; }

    if [ "$field" == "expected_value" ]; then
        echo "Field matches expected value"
        return 0
    else
        print_status "FAIL" "Expected 'expected_value', got '$field'"
        return 1
    fi
}

# =============================================================================
# Execute Tests
# =============================================================================
run_test "AC1: Description" test_ac1_description
# run_test "AC2: Description" test_ac2_description

# =============================================================================
# Summary with Timing Table
# =============================================================================
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo "Total:  $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""
echo "Detailed Results:"
printf "%-3s | %-42s | %-8s | %s\n" "#" "Test Name" "Status" "Time (s)"
echo "----+--------------------------------------------+----------+----------"

for i in "${!TEST_NAMES[@]}"; do
    num=$((i + 1))
    name="${TEST_NAMES[$i]}"
    status="${TEST_STATUSES[$i]}"
    duration="${TEST_DURATIONS[$i]}"

    [ ${#name} -gt 42 ] && name="${name:0:39}..."
    printf "%-3d | %-42s | %-8s | %8s\n" "$num" "$name" "$status" "$duration"
done

echo ""
echo "Total execution time: ${TOTAL_DURATION}s"
echo "Completed at $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

[ $FAILED -eq 0 ] && print_status "PASS" "All tests passed!" && exit 0
print_status "FAIL" "$FAILED test(s) failed" && exit 1
