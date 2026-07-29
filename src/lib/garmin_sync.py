import sys
import json
import os

try:
    from garminconnect import Garmin, GarminConnectAuthenticationError
except ImportError:
    print(json.dumps({"status": "error", "message": "garminconnect python package not installed"}))
    sys.exit(1)

def main():
    try:
        input_data = json.loads(sys.stdin.read())
        email = input_data.get("email")
        password = input_data.get("password")
        mfa_code = input_data.get("mfa_code")

        if not email or not password:
            print(json.dumps({"status": "error", "message": "Email and password are required"}))
            return

        # Initialize Garmin client
        # Optional: store token session in a temp folder or pass tokenstore
        client = Garmin(email, password)

        if mfa_code:
            # Resume login with MFA code
            try:
                client.resume_login(mfa_code)
            except Exception as e:
                print(json.dumps({"status": "error", "message": f"MFA 인증 실패: {str(e)}"}))
                return
        else:
            try:
                # Initial login attempt
                res = client.login()
                # Check if login returned an MFA prompt
                if res and isinstance(res, tuple) and res[0] is not None:
                    # res[0] indicates MFA prompt / challenge
                    print(json.dumps({
                        "status": "mfa_required",
                        "message": "등록된 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 인증 코드를 입력해 주세요."
                    }))
                    return
            except Exception as e:
                err_str = str(e)
                if "MFA" in err_str or "mfa" in err_str or "code" in err_str.lower():
                    print(json.dumps({
                        "status": "mfa_required",
                        "message": "등록된 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 인증 코드를 입력해 주세요."
                    }))
                    return
                else:
                    print(json.dumps({"status": "error", "message": f"Garmin 로그인 실패: {err_str}"}))
                    return

        # Fetch activities
        activities = client.get_activities(0, 30)
        
        # Transform and filter run activities
        runs = []
        for a in (activities or []):
            activity_type = (a.get("activityType", {}).get("typeKey") or "").lower()
            parent_type = a.get("activityType", {}).get("parentTypeId", 0)
            
            if "run" in activity_type or parent_type == 1:
                runs.append({
                    "activityId": a.get("activityId"),
                    "activityName": a.get("activityName"),
                    "startTimeLocal": a.get("startTimeLocal") or a.get("startTimeGMT"),
                    "distance": a.get("distance", 0), # in meters
                    "duration": a.get("movingDuration") or a.get("duration", 0), # in seconds
                    "averageHR": a.get("averageHR"),
                    "maxHR": a.get("maxHR"),
                    "calories": a.get("calories", 0),
                    "elevationGain": a.get("elevationGain", 0)
                })

        print(json.dumps({
            "status": "success",
            "total_activities": len(activities or []),
            "runs": runs
        }))

    except Exception as err:
        print(json.dumps({"status": "error", "message": f"오류 발생: {str(err)}"}))

if __name__ == "__main__":
    main()
