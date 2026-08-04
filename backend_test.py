#!/usr/bin/env python3
"""
SEMEX Backend Testing - Redeem & Session Persistence Fixes
Tests the fixes for:
1. Expired users can still get session (no forced logout on 402)
2. Expired users can redeem codes (catch-22 fix)
"""

import requests
import json
import sys

# Configuration from test_credentials.md
BASE_URL = "https://address-mode-select.preview.emergentagent.com"
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJFUDdoTGpNWktOalZIYUlqOXFIQy1xUWIxV2ZhYjJDaCIsInRpZCI6OTk5MDAwMTExLCJmcCI6InRlc3QtZnAtMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIiwiaWF0IjoxNzg0MjgwODAzLCJleHAiOjE3ODQyODQ0MDMsInR5cCI6ImFjY2VzcyJ9.IXaZg9B-NeI8uStfChD-QzFLIw2RPa8EgAEE9HSEn-4"
FINGERPRINT = "test-fp-000000000000000000000000000000"
REDEEM_CODE = "SEMEX-6LTZ-Z9QB-FYVR"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "X-Fingerprint": FINGERPRINT,
    "Content-Type": "application/json"
}

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"  {details}")

def test_1_session_persistence_expired_plan():
    """TEST 1: Session persistence with expired plan (should NOT force logout)"""
    print("\n" + "="*80)
    print("TEST 1: SESSION PERSISTENCE (expired plan should NOT force logout)")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/auth/session", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 401:
            print_test("Session Persistence", False, "Got 401 - token expired. Need to regenerate with seed_test_session.py")
            return False
        
        if response.status_code != 200:
            print_test("Session Persistence", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required fields
        if not data.get("valid"):
            print_test("Session Persistence", False, "valid should be true")
            return False
        
        if data.get("hasAccess") != False:
            print_test("Session Persistence", False, f"hasAccess should be false (expired plan), got {data.get('hasAccess')}")
            return False
        
        if data.get("requiresRedeem") != True:
            print_test("Session Persistence", False, f"requiresRedeem should be true (expired plan), got {data.get('requiresRedeem')}")
            return False
        
        print_test("Session Persistence", True, "Expired user gets 200 with valid:true, hasAccess:false, requiresRedeem:true")
        return True
        
    except Exception as e:
        print_test("Session Persistence", False, f"Exception: {str(e)}")
        return False

def test_2_redeem_valid_code():
    """TEST 2: Redeem a valid code (expired user must be able to redeem)"""
    print("\n" + "="*80)
    print("TEST 2: REDEEM VALID CODE (expired user can redeem - catch-22 fix)")
    print("="*80)
    
    try:
        payload = {"code": REDEEM_CODE}
        response = requests.post(f"{BASE_URL}/api/auth/redeem", headers=headers, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 200:
            print_test("Redeem Valid Code", False, f"Expected 200, got {response.status_code}. Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        if not data.get("success"):
            print_test("Redeem Valid Code", False, "success should be true")
            return False
        
        if data.get("plan") != "MONTHLY":
            print_test("Redeem Valid Code", False, f"plan should be MONTHLY, got {data.get('plan')}")
            return False
        
        if data.get("durationDays") != 30:
            print_test("Redeem Valid Code", False, f"durationDays should be 30, got {data.get('durationDays')}")
            return False
        
        # Check planExpiresAt is in the future
        plan_expires = data.get("planExpiresAt")
        if not plan_expires:
            print_test("Redeem Valid Code", False, "planExpiresAt missing")
            return False
        
        print_test("Redeem Valid Code", True, f"Code redeemed successfully. Plan: MONTHLY, expires: {plan_expires}, duration: 30 days")
        return True
        
    except Exception as e:
        print_test("Redeem Valid Code", False, f"Exception: {str(e)}")
        return False

def test_3_double_redeem_guard():
    """TEST 3: Double-redeem guard (same code should fail)"""
    print("\n" + "="*80)
    print("TEST 3: DOUBLE-REDEEM GUARD (same code should be rejected)")
    print("="*80)
    
    try:
        payload = {"code": REDEEM_CODE}
        response = requests.post(f"{BASE_URL}/api/auth/redeem", headers=headers, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 400:
            print_test("Double-Redeem Guard", False, f"Expected 400 (already redeemed), got {response.status_code}")
            return False
        
        print_test("Double-Redeem Guard", True, "Second redeem correctly rejected with 400")
        return True
        
    except Exception as e:
        print_test("Double-Redeem Guard", False, f"Exception: {str(e)}")
        return False

def test_4_invalid_code():
    """TEST 4: Invalid code should fail"""
    print("\n" + "="*80)
    print("TEST 4: INVALID CODE (should be rejected)")
    print("="*80)
    
    try:
        payload = {"code": "SEMEX-XXXX-XXXX-XXXX"}
        response = requests.post(f"{BASE_URL}/api/auth/redeem", headers=headers, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 400:
            print_test("Invalid Code", False, f"Expected 400 (invalid code), got {response.status_code}")
            return False
        
        print_test("Invalid Code", True, "Invalid code correctly rejected with 400")
        return True
        
    except Exception as e:
        print_test("Invalid Code", False, f"Exception: {str(e)}")
        return False

def test_5_redeem_without_auth():
    """TEST 5: Redeem without auth (should require authentication)"""
    print("\n" + "="*80)
    print("TEST 5: REDEEM WITHOUT AUTH (should require authentication)")
    print("="*80)
    
    try:
        payload = {"code": "anything"}
        headers_no_auth = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/auth/redeem", headers=headers_no_auth, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 401:
            print_test("Redeem Without Auth", False, f"Expected 401 (unauthorized), got {response.status_code}")
            return False
        
        print_test("Redeem Without Auth", True, "Redeem without auth correctly rejected with 401")
        return True
        
    except Exception as e:
        print_test("Redeem Without Auth", False, f"Exception: {str(e)}")
        return False

def test_6_session_after_redeem():
    """TEST 6: Session after redeem (access should now be granted)"""
    print("\n" + "="*80)
    print("TEST 6: SESSION AFTER REDEEM (access now granted)")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/auth/session", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 200:
            print_test("Session After Redeem", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required fields
        if not data.get("valid"):
            print_test("Session After Redeem", False, "valid should be true")
            return False
        
        if data.get("hasAccess") != True:
            print_test("Session After Redeem", False, f"hasAccess should be true (after redeem), got {data.get('hasAccess')}")
            return False
        
        if data.get("requiresRedeem") != False:
            print_test("Session After Redeem", False, f"requiresRedeem should be false (after redeem), got {data.get('requiresRedeem')}")
            return False
        
        print_test("Session After Redeem", True, "After redeem: valid:true, hasAccess:true, requiresRedeem:false")
        return True
        
    except Exception as e:
        print_test("Session After Redeem", False, f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("SEMEX BACKEND TESTING - REDEEM & SESSION PERSISTENCE FIXES")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing with expired user's token")
    print("="*80)
    
    results = []
    
    # Test 1: Session persistence with expired plan
    results.append(("Session Persistence (Expired Plan)", test_1_session_persistence_expired_plan()))
    
    # If test 1 failed with 401, stop and ask to regenerate token
    if not results[0][1] and "401" in str(results[0]):
        print("\n" + "="*80)
        print("⚠️  TOKEN EXPIRED - Please regenerate with:")
        print("    cd /app/backend && python seed_test_session.py")
        print("="*80)
        sys.exit(1)
    
    # Test 2: Redeem valid code
    results.append(("Redeem Valid Code", test_2_redeem_valid_code()))
    
    # Test 3: Double-redeem guard
    results.append(("Double-Redeem Guard", test_3_double_redeem_guard()))
    
    # Test 4: Invalid code
    results.append(("Invalid Code", test_4_invalid_code()))
    
    # Test 5: Redeem without auth
    results.append(("Redeem Without Auth", test_5_redeem_without_auth()))
    
    # Test 6: Session after redeem
    results.append(("Session After Redeem", test_6_session_after_redeem()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
