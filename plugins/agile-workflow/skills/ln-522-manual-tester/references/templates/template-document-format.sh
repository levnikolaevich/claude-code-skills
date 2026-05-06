#!/bin/bash
# =============================================================================
# {STORY-ID}: {FORMAT} Format Support
# =============================================================================
# AC tested: AC1, AC2, AC3...
# Prerequisites: Docker running, jq installed
# Usage: ./test-{format}.sh
# =============================================================================

set -e
THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$THIS_DIR/../config.sh"

check_jq
check_api
setup_auth

# Directories
SAMPLES_DIR="$THIS_DIR/samples"
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
# Helpers (document workflow)
# =============================================================================

upload_document() {
    local file_path=$1 source_lang=$2 target_lang=$3
    curl -s -w "\n%{http_code}" -X POST "$BASE_URL/v1/documents/translate" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -F "file=@$file_path" \
        -F "source_lang=$source_lang" \
        -F "target_lang=$target_lang"
}

poll_job() {
    local job_id=$1 max_attempts=${2:-30}
    for ((i=0; i<max_attempts; i++)); do
        local response=$(curl -s "$BASE_URL/v1/jobs/$job_id" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        local status=$(echo "$response" | jq -r '.status')
        case $status in
            "completed") echo "$response"; return 0 ;;
            "failed") echo "$response"; return 1 ;;
            *) sleep 2 ;;
        esac
    done
    return 1
}

download_result() {
    local job_id=$1 output_file=$2
    curl -s "$BASE_URL/v1/jobs/$job_id/result" \
        -H "Authorization: Bearer $ACCESS_TOKEN" -o "$output_file"
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

    sleep 2
}

# =============================================================================
# AC1: Basic translation
# =============================================================================
test_ac1_basic_translation() {
    local full_response=$(upload_document "$SAMPLES_DIR/sample.ext" "en" "fr")
    local http_code=$(echo "$full_response" | tail -1)
    local response=$(echo "$full_response" | sed '$d')

    # Strict validation: HTTP 202
    if [ "$http_code" != "202" ]; then
        print_status "FAIL" "Expected HTTP 202, got $http_code"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 1
    fi

    local job_id=$(echo "$response" | jq -r '.job_id // empty')
    [ -z "$job_id" ] && { print_status "FAIL" "No job_id"; return 1; }

    # Poll job
    if ! poll_job "$job_id" >/dev/null; then
        print_status "FAIL" "Job failed or timed out"
        return 1
    fi

    # Download result
    local result_file="$RESULTS_DIR/result_ac1.ext"
    download_result "$job_id" "$result_file"

    # Expected-based validation (PRIMARY)
    local expected_file="$EXPECTED_DIR/sample_en-fr.ext"
    if diff -q "$result_file" "$expected_file" > /dev/null 2>&1; then
        echo "Output matches expected"
        return 0
    else
        print_status "FAIL" "Output differs from expected"
        echo ""
        echo "Expected (first 20 lines):"
        head -20 "$expected_file"
        echo ""
        echo "Actual (first 20 lines):"
        head -20 "$result_file"
        echo ""
        echo "Diff (first 30 lines):"
        diff "$expected_file" "$result_file" | head -30 || true
        return 1
    fi
}

# =============================================================================
# Execute Tests
# =============================================================================
run_test "AC1: Basic translation" test_ac1_basic_translation
# run_test "AC2: Edge case" test_ac2_edge_case

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
