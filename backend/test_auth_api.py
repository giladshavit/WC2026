#!/usr/bin/env python3
"""
Test script for authentication API endpoints.
"""

import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_auth_endpoints():
    """Test all authentication endpoints."""
    
    print("🧪 Testing Authentication API Endpoints")
    print("=" * 50)
    
    # Test data
    import time
    timestamp = int(time.time())
    test_user = {
        "username": f"testuser{timestamp}",
        "password": "testpass123",
        "name": "Test User"
    }
    
    # 1. Test user registration
    print("\n1. Testing user registration...")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=test_user)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Registration successful!")
            print(f"   User ID: {data['user_id']}")
            print(f"   Username: {data['username']}")
            print(f"   Name: {data['name']}")
            print(f"   Token: {data['access_token'][:50]}...")
            access_token = data['access_token']
        else:
            print(f"❌ Registration failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        return
    
    # 2. Test user login
    print("\n2. Testing user login...")
    try:
        login_data = {
            "username": test_user["username"],
            "password": test_user["password"]
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login successful!")
            print(f"   User ID: {data['user_id']}")
            print(f"   Username: {data['username']}")
            print(f"   Name: {data['name']}")
            print(f"   Token: {data['access_token'][:50]}...")
        else:
            print(f"❌ Login failed: {response.text}")
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
    
    # 3. Test get current user info
    print("\n3. Testing get current user info...")
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get user info successful!")
            print(f"   User ID: {data['user_id']}")
            print(f"   Username: {data['username']}")
            print(f"   Name: {data['name']}")
            print(f"   Total Points: {data['total_points']}")
            print(f"   Created: {data['created_at']}")
            print(f"   Last Login: {data['last_login']}")
        else:
            print(f"❌ Get user info failed: {response.text}")
    except Exception as e:
        print(f"❌ Get user info error: {str(e)}")
    
    # 4. Test token refresh
    print("\n4. Testing token refresh...")
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(f"{BASE_URL}/auth/refresh", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Token refresh successful!")
            print(f"   New Token: {data['access_token'][:50]}...")
        else:
            print(f"❌ Token refresh failed: {response.text}")
    except Exception as e:
        print(f"❌ Token refresh error: {str(e)}")
    
    # 5. Test invalid login
    print("\n5. Testing invalid login...")
    try:
        invalid_login = {
            "username": test_user["username"],
            "password": "wrongpassword"
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=invalid_login)
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print(f"✅ Invalid login correctly rejected!")
        else:
            print(f"❌ Invalid login should have been rejected: {response.text}")
    except Exception as e:
        print(f"❌ Invalid login test error: {str(e)}")
    
    # 6. Test invalid token
    print("\n6. Testing invalid token...")
    try:
        headers = {"Authorization": "Bearer invalid_token"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print(f"✅ Invalid token correctly rejected!")
        else:
            print(f"❌ Invalid token should have been rejected: {response.text}")
    except Exception as e:
        print(f"❌ Invalid token test error: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🎉 Authentication API testing completed!")

if __name__ == "__main__":
    test_auth_endpoints()
