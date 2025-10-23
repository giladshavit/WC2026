import requests
import time

BASE_URL = "http://localhost:8000/api"

def test_leagues_endpoints():
    """Test all league endpoints."""
    
    print("🧪 Testing League API Endpoints")
    print("=" * 50)
    
    # First, register and login a test user
    timestamp = int(time.time())
    test_user = {
        "username": f"leaguetest{timestamp}",
        "password": "testpass123",
        "name": "League Test User"
    }
    
    # 1. Register user
    print("\n1. Registering test user...")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=test_user)
        if response.status_code == 200:
            register_data = response.json()
            access_token = register_data['access_token']
            print("✅ User registered successfully!")
        else:
            print(f"❌ Registration failed: {response.json()}")
            return
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return

    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Create a league
    print("\n2. Creating a league...")
    try:
        league_data = {
            "name": "Test League",
            "description": "A test league for API testing"
        }
        response = requests.post(f"{BASE_URL}/leagues", json=league_data, headers=headers)
        if response.status_code == 200:
            league = response.json()
            print("✅ League created successfully!")
            print(f"   League ID: {league['id']}")
            print(f"   Invite Code: {league['invite_code']}")
            league_id = league['id']
            invite_code = league['invite_code']
        else:
            print(f"❌ League creation failed: {response.json()}")
            return
    except Exception as e:
        print(f"❌ League creation error: {e}")
        return

    # 3. Get user leagues
    print("\n3. Getting user leagues...")
    try:
        response = requests.get(f"{BASE_URL}/leagues", headers=headers)
        if response.status_code == 200:
            leagues = response.json()
            print(f"✅ Found {len(leagues)} leagues")
            for league in leagues:
                print(f"   - {league['name']} ({league['member_count']} members)")
        else:
            print(f"❌ Failed to get leagues: {response.json()}")
    except Exception as e:
        print(f"❌ Get leagues error: {e}")

    # 4. Get league info
    print("\n4. Getting league info...")
    try:
        response = requests.get(f"{BASE_URL}/leagues/{league_id}", headers=headers)
        if response.status_code == 200:
            league_info = response.json()
            print("✅ League info retrieved successfully!")
            print(f"   Name: {league_info['name']}")
            print(f"   Members: {league_info['member_count']}")
        else:
            print(f"❌ Failed to get league info: {response.json()}")
    except Exception as e:
        print(f"❌ Get league info error: {e}")

    # 5. Get league standings
    print("\n5. Getting league standings...")
    try:
        response = requests.get(f"{BASE_URL}/leagues/{league_id}/standings", headers=headers)
        if response.status_code == 200:
            standings = response.json()
            print("✅ League standings retrieved successfully!")
            print(f"   League: {standings['league_info']['name']}")
            print(f"   Members: {len(standings['standings'])}")
            for standing in standings['standings']:
                print(f"   - {standing['name']}: {standing['total_points']} pts")
        else:
            print(f"❌ Failed to get league standings: {response.json()}")
    except Exception as e:
        print(f"❌ Get league standings error: {e}")

    # 6. Get global standings
    print("\n6. Getting global standings...")
    try:
        response = requests.get(f"{BASE_URL}/leagues/global")
        if response.status_code == 200:
            global_standings = response.json()
            print("✅ Global standings retrieved successfully!")
            print(f"   Total players: {len(global_standings['standings'])}")
            for i, standing in enumerate(global_standings['standings'][:3]):  # Show top 3
                print(f"   {i+1}. {standing['name']}: {standing['total_points']} pts")
        else:
            print(f"❌ Failed to get global standings: {response.json()}")
    except Exception as e:
        print(f"❌ Get global standings error: {e}")

    # 7. Test joining league with invite code (create another user)
    print("\n7. Testing join league with invite code...")
    try:
        # Register another user
        test_user2 = {
            "username": f"leaguetest2{timestamp}",
            "password": "testpass123",
            "name": "League Test User 2"
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=test_user2)
        if response.status_code == 200:
            register_data2 = response.json()
            access_token2 = register_data2['access_token']
            headers2 = {"Authorization": f"Bearer {access_token2}"}
            
            # Join the league
            join_data = {"invite_code": invite_code}
            response = requests.post(f"{BASE_URL}/leagues/join", json=join_data, headers=headers2)
            if response.status_code == 200:
                join_result = response.json()
                print("✅ Successfully joined league!")
                print(f"   Joined: {join_result['league_name']}")
            else:
                print(f"❌ Failed to join league: {response.json()}")
        else:
            print(f"❌ Failed to register second user: {response.json()}")
    except Exception as e:
        print(f"❌ Join league error: {e}")

    print("\n" + "=" * 50)
    print("🎉 League API testing completed!")

if __name__ == "__main__":
    test_leagues_endpoints()
