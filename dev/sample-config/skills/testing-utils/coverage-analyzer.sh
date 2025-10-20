#!/bin/bash
# Coverage analysis utility for Overture

set -e

# Configuration
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-80}
OUTPUT_FORMAT=${OUTPUT_FORMAT:-"text"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

analyze_python_coverage() {
    echo "Analyzing Python test coverage..."

    if ! command -v pytest &> /dev/null; then
        echo "${RED}pytest not found. Please install pytest.${NC}"
        exit 1
    fi

    pytest --cov=. --cov-report=term --cov-report=json

    # Parse coverage from JSON report
    if [ -f coverage.json ]; then
        COVERAGE=$(python3 -c "import json; print(json.load(open('coverage.json'))['totals']['percent_covered'])")
        echo "Coverage: ${COVERAGE}%"

        if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
            echo "${RED}Coverage ${COVERAGE}% is below threshold ${COVERAGE_THRESHOLD}%${NC}"
            exit 1
        else
            echo "${GREEN}Coverage ${COVERAGE}% meets threshold ${COVERAGE_THRESHOLD}%${NC}"
        fi
    fi
}

analyze_javascript_coverage() {
    echo "Analyzing JavaScript test coverage..."

    if [ -f package.json ]; then
        if npm run test:coverage &> /dev/null; then
            echo "${GREEN}Coverage tests completed${NC}"
        else
            echo "${YELLOW}No coverage script found in package.json${NC}"
        fi
    fi
}

analyze_go_coverage() {
    echo "Analyzing Go test coverage..."

    if [ -f go.mod ]; then
        go test -cover -coverprofile=coverage.out ./...
        go tool cover -func=coverage.out | tail -1

        COVERAGE=$(go tool cover -func=coverage.out | tail -1 | awk '{print $3}' | sed 's/%//')

        if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
            echo "${RED}Coverage ${COVERAGE}% is below threshold ${COVERAGE_THRESHOLD}%${NC}"
            exit 1
        else
            echo "${GREEN}Coverage ${COVERAGE}% meets threshold ${COVERAGE_THRESHOLD}%${NC}"
        fi
    fi
}

# Main execution
main() {
    echo "=== Test Coverage Analysis ==="

    # Detect project type and run appropriate analyzer
    if [ -f pytest.ini ] || [ -f setup.py ]; then
        analyze_python_coverage
    elif [ -f package.json ]; then
        analyze_javascript_coverage
    elif [ -f go.mod ]; then
        analyze_go_coverage
    else
        echo "${YELLOW}No recognized test framework found${NC}"
        exit 0
    fi
}

main "$@"
