#!/usr/bin/env python3
"""
Backend API Testing for ZVG-Portal Termin-Extraktor
Tests all API endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime

class ZVGAPITester:
    def __init__(self, base_url="https://termin-extractor-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'message' in response_data:
                        print(f"   Message: {response_data['message']}")
                    elif isinstance(response_data, list):
                        print(f"   Returned {len(response_data)} items")
                    elif isinstance(response_data, dict) and 'total' in response_data:
                        print(f"   Total items: {response_data.get('total', 'N/A')}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint
                })

            return success, response.json() if success and response.content else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.failed_tests.append({'test': name, 'error': 'timeout', 'endpoint': endpoint})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({'test': name, 'error': str(e), 'endpoint': endpoint})
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_bundeslaender(self):
        """Test bundeslaender endpoint"""
        success, data = self.run_test("Get Bundesländer", "GET", "bundeslaender", 200)
        if success and isinstance(data, list) and len(data) > 0:
            print(f"   Found {len(data)} Bundesländer")
            return True
        return False

    def test_objekt_typen(self):
        """Test objekt-typen endpoint"""
        success, data = self.run_test("Get Objekt Typen", "GET", "objekt-typen", 200)
        if success and isinstance(data, list) and len(data) > 0:
            print(f"   Found {len(data)} Objekt Typen")
            return True
        return False

    def test_statistics(self):
        """Test statistics endpoint"""
        success, data = self.run_test("Get Statistics", "GET", "statistics", 200)
        if success and isinstance(data, dict):
            total = data.get('total', 0)
            by_classification = data.get('by_classification', {})
            by_state = data.get('by_state', {})
            print(f"   Total foreclosures: {total}")
            print(f"   Classifications: {list(by_classification.keys())}")
            print(f"   States: {list(by_state.keys())}")
            return True
        return False

    def test_foreclosures(self):
        """Test foreclosures endpoint"""
        success, data = self.run_test("Get All Foreclosures", "GET", "foreclosures", 200)
        if success and isinstance(data, list):
            print(f"   Found {len(data)} foreclosures")
            if len(data) > 0:
                sample = data[0]
                required_fields = ['id', 'aktenzeichen', 'gericht', 'bundesland', 'termin_datum']
                missing_fields = [field for field in required_fields if field not in sample]
                if missing_fields:
                    print(f"   ⚠️  Missing required fields: {missing_fields}")
                else:
                    print(f"   ✅ All required fields present")
            return True
        return False

    def test_foreclosures_with_filters(self):
        """Test foreclosures with filters"""
        # Test with bundesland filter
        success1, data1 = self.run_test("Get Foreclosures (BW filter)", "GET", "foreclosures", 200, params={"bundesland": "bw"})
        
        # Test with klassifizierung filter
        success2, data2 = self.run_test("Get Foreclosures (Wohnhäuser filter)", "GET", "foreclosures", 200, params={"klassifizierung": "Wohnhäuser"})
        
        return success1 and success2

    def test_classification_rules(self):
        """Test classification rules endpoint"""
        success, data = self.run_test("Get Classification Rules", "GET", "classification-rules", 200)
        if success and isinstance(data, list):
            print(f"   Found {len(data)} classification rules")
            if len(data) > 0:
                sample = data[0]
                required_fields = ['id', 'name', 'objekt_typ_ids', 'active']
                missing_fields = [field for field in required_fields if field not in sample]
                if missing_fields:
                    print(f"   ⚠️  Missing required fields: {missing_fields}")
                else:
                    print(f"   ✅ All required fields present")
            return True
        return False

    def test_settings(self):
        """Test settings endpoint"""
        success, data = self.run_test("Get Settings", "GET", "settings", 200)
        if success and isinstance(data, dict):
            print(f"   Email notifications: {data.get('email_notifications_enabled', False)}")
            print(f"   Selected Bundesländer: {data.get('selected_bundeslaender', [])}")
            return True
        return False

    def test_notifications(self):
        """Test notifications endpoint"""
        success, data = self.run_test("Get Notifications", "GET", "notifications", 200)
        if success and isinstance(data, list):
            print(f"   Found {len(data)} notifications")
            unread = len([n for n in data if not n.get('read', True)])
            print(f"   Unread: {unread}")
            return True
        return False

    def test_fetch_data(self):
        """Test manual data fetch"""
        print(f"\n🔍 Testing Manual Data Fetch...")
        print(f"   This may take 10-30 seconds as it fetches demo data...")
        success, data = self.run_test("Trigger Data Fetch", "POST", "fetch", 200)
        if success and isinstance(data, dict):
            status = data.get('status', '')
            message = data.get('message', '')
            new_count = data.get('new_count', 0)
            total_count = data.get('total_count', 0)
            print(f"   Status: {status}")
            print(f"   New foreclosures: {new_count}")
            print(f"   Total processed: {total_count}")
            return True
        return False

    def test_settings_update(self):
        """Test settings update"""
        update_data = {
            "email_notifications_enabled": False,
            "selected_bundeslaender": ["bw", "by"]
        }
        success, data = self.run_test("Update Settings", "PUT", "settings", 200, data=update_data)
        if success:
            # Verify the update
            success2, verify_data = self.run_test("Verify Settings Update", "GET", "settings", 200)
            if success2:
                if verify_data.get('selected_bundeslaender') == ["bw", "by"]:
                    print(f"   ✅ Settings update verified")
                    return True
                else:
                    print(f"   ⚠️  Settings not properly updated")
        return False

    def test_individual_foreclosure(self):
        """Test getting individual foreclosure"""
        # First get all foreclosures to get an ID
        success, data = self.run_test("Get Foreclosures for ID", "GET", "foreclosures", 200)
        if success and isinstance(data, list) and len(data) > 0:
            foreclosure_id = data[0]['id']
            success2, detail_data = self.run_test(f"Get Foreclosure Detail", "GET", f"foreclosures/{foreclosure_id}", 200)
            if success2 and isinstance(detail_data, dict):
                print(f"   Retrieved foreclosure: {detail_data.get('aktenzeichen', 'N/A')}")
                return True
        return False

def main():
    print("🏛️  ZVG-Portal Termin-Extraktor Backend API Tests")
    print("=" * 60)
    
    tester = ZVGAPITester()
    
    # Run all tests
    tests = [
        tester.test_root_endpoint,
        tester.test_bundeslaender,
        tester.test_objekt_typen,
        tester.test_statistics,
        tester.test_foreclosures,
        tester.test_foreclosures_with_filters,
        tester.test_classification_rules,
        tester.test_settings,
        tester.test_notifications,
        tester.test_individual_foreclosure,
        tester.test_settings_update,
        tester.test_fetch_data,  # Run this last as it may add new data
    ]
    
    print(f"\nRunning {len(tests)} test suites...")
    
    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test suite failed with exception: {e}")
            tester.failed_tests.append({'test': test_func.__name__, 'error': str(e)})
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 Test Results Summary")
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            error_msg = failure.get('error', f"Expected {failure.get('expected')}, got {failure.get('actual')}")
            print(f"   - {failure['test']}: {error_msg}")
    
    # Return appropriate exit code
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())