import boto3
import os
import cv2
import json
import mediapipe as mp
import numpy as np
import math
from urllib.parse import unquote_plus
from models import Landmark, FrameLandmarks

mp_pose = mp.solutions.pose
s3 = boto3.client('s3')

def lambda_handler(event, context):
    object_key = unquote_plus(event['key'])
    input_file_name = os.path.basename(object_key)
    name_stem, _ = os.path.splitext(input_file_name)

    # Buckets
    source_bucket = "human-pose-input-videos"
    target_bucket = "human-pose-output-videos"

    # Local temp paths
    input_path = f"/tmp/{input_file_name}"
    output_path = "/tmp/output-annotated.mp4"
    landmark_path = "/tmp/landmarks.json"

    # Download from input bucket
    # If your S3 objects live under prefixes, use `object_key` instead of `input_file_name`.
    s3.download_file(source_bucket, object_key, input_path)

    # Process and produce outputs locally
    process_video(input_path, output_path, landmark_path)

    # Output keys based on input name
    video_key = f"{name_stem}-video.mp4"
    landmarks_key = f"{name_stem}-landmarks.json"

    # Upload to output bucket
    s3.upload_file(output_path, target_bucket, video_key)
    s3.upload_file(landmark_path, target_bucket, landmarks_key)

    return {
        "statusCode": 200,
        "body": f"s3://{target_bucket}/{video_key}",
        "landmarks": f"s3://{target_bucket}/{landmarks_key}",
    }

def process_video(input_path, output_path, landmark_path):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise Exception("❌ Cannot open video")

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    # 🔹 Pass 1: Extract landmark data
    landmark_data = extract_pose_landmarks(cap)

    # 🔹 Serialize landmarks
    mp_pose = mp.solutions.pose

    with open(landmark_path, "w") as f:
        json.dump(serialize_landmarks(landmark_data), f)

    # 🔹 Pass 2: Annotate
    cap = cv2.VideoCapture(input_path)
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame_idx >= len(landmark_data):
            break
        landmarks = landmark_data[frame_idx]
        plotted_video = plot_video(mp_pose, frame.copy(), landmarks, (width, height), frame_idx)
        out.write(plotted_video)
        frame_idx += 1

    cap.release()
    out.release()
    
    return

def mediapipe_to_framelandmarks(frame_idx, mp_landmarks):
    # mp_landmarks: list of 33 landmarks
    landmark_names = [lmk.name for lmk in mp_pose.PoseLandmark]
    landmarks_dict = {
        name: Landmark(
            x=lm.x,
            y=lm.y,
            z=lm.z,
            visibility=lm.visibility
        )
        for name, lm in zip(landmark_names, mp_landmarks)
    }
    return FrameLandmarks(frame=frame_idx, landmarks=landmarks_dict)

def extract_pose_landmarks(cap):
    pose = mp_pose.Pose(static_image_mode=False)
    landmarks_per_frame = []
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)

        if results.pose_landmarks:
            # Convert to your dataclass here:
            landmarks_per_frame.append(
                mediapipe_to_framelandmarks(frame_idx, results.pose_landmarks.landmark)
            )
        else:
            landmarks_per_frame.append(None)
        frame_idx += 1

    cap.release()
    return landmarks_per_frame

def plot_video(mp_pose, frame, landmarks, frame_dims, frame_idx):
    if not landmarks: return frame

    shoulder = get_point(landmarks, mp_pose.PoseLandmark.LEFT_SHOULDER.name)
    elbow = get_point(landmarks, mp_pose.PoseLandmark.LEFT_ELBOW.name)
    wrist = get_point(landmarks, mp_pose.PoseLandmark.LEFT_WRIST.name)
    hip = get_point(landmarks, mp_pose.PoseLandmark.LEFT_HIP.name)
    knee = get_point(landmarks, mp_pose.PoseLandmark.LEFT_KNEE.name)
    ankle = get_point(landmarks, mp_pose.PoseLandmark.LEFT_ANKLE.name)
    index_finger = get_point(landmarks, mp_pose.PoseLandmark.LEFT_INDEX.name)

    shoulder_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_SHOULDER.name, frame_dims)
    elbow_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_ELBOW.name, frame_dims)
    wrist_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_WRIST.name, frame_dims)
    hip_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_HIP.name, frame_dims)
    knee_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_KNEE.name, frame_dims)
    ankle_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_ANKLE.name, frame_dims)
    index_finger_display = get_drawing_point(landmarks, mp_pose.PoseLandmark.LEFT_INDEX.name, frame_dims)

    elbow_angle = calculate_angle(shoulder, elbow, wrist)
    wrist_angle = calculate_angle(elbow, wrist, index_finger)
    shoulder_angle = calculate_angle(elbow, shoulder, hip)
    hip_angle = calculate_angle(shoulder, hip, knee)
    knee_angle = calculate_angle(hip, knee, ankle)
    elbow_flaring_angle = calculate_angle(shoulder, elbow, hip)

    cv2.putText(frame, f"Frame: {frame_idx}", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

    # Only draw text if the angle is valid and the point is valid
    if is_valid_point(elbow_display) and is_valid_angle(elbow_angle):
        cv2.putText(frame, f"Elbow: {int(elbow_angle)}°", (elbow_display[0] - 30, elbow_display[1] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    if is_valid_point(wrist_display) and is_valid_angle(wrist_angle):
        cv2.putText(frame, f"Wrist: {int(wrist_angle)}°", (wrist_display[0] - 30, wrist_display[1] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 0), 2)
    if is_valid_point(shoulder_display) and is_valid_angle(shoulder_angle):
        cv2.putText(frame, f"Shoulder: {int(shoulder_angle)}°", (shoulder_display[0] - 30, shoulder_display[1] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
    if is_valid_point(hip_display) and is_valid_angle(hip_angle):
        cv2.putText(frame, f"Hip: {int(hip_angle)}°", (hip_display[0] - 30, hip_display[1] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
    if is_valid_point(knee_display) and is_valid_angle(knee_angle):
        cv2.putText(frame, f"Knee: {int(knee_angle)}°", (knee_display[0] - 30, knee_display[1] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    if is_valid_point(elbow_display) and is_valid_angle(elbow_flaring_angle):
        cv2.putText(frame, f"Elbow Flaring: {int(elbow_flaring_angle)}°", (elbow_display[0] - 30, elbow_display[1] - 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 200, 255), 2)

        # Only draw lines if all points are valid
    if is_valid_point(index_finger_display) and is_valid_point(wrist_display):
        cv2.line(frame, index_finger_display, wrist_display, (150, 50, 255), 2)
    if is_valid_point(wrist_display) and is_valid_point(elbow_display):
        cv2.line(frame, wrist_display, elbow_display, (0, 255, 255), 2)
    if is_valid_point(elbow_display) and is_valid_point(shoulder_display):
        cv2.line(frame, elbow_display, shoulder_display, (0, 255, 0), 2)
    if is_valid_point(shoulder_display) and is_valid_point(hip_display):
        cv2.line(frame, shoulder_display, hip_display, (255, 0, 0), 2)
    if is_valid_point(hip_display) and is_valid_point(knee_display):
        cv2.line(frame, hip_display, knee_display, (0, 0, 255), 2)
    if is_valid_point(knee_display) and is_valid_point(ankle_display):
        cv2.line(frame, knee_display, ankle_display, (0, 165, 255), 2)
    if is_valid_point(shoulder_display) and is_valid_point(elbow_display):
        cv2.line(frame, shoulder_display, elbow_display, (255, 255, 0), 2)  # yellow line
    if is_valid_point(hip_display) and is_valid_point(elbow_display):
        cv2.line(frame, hip_display, elbow_display, (0, 255, 255), 2)

    return frame

def get_point(frame_with_landmarks: FrameLandmarks, name: str) -> list[float]:
    landmark = frame_with_landmarks.landmarks[name]
    return [landmark.x, landmark.y, landmark.z]

def calculate_angle(a: list[float], b: list[float], c: list[float]) -> float:
    a, b, c = np.array(a), np.array(b), np.array(c)
    ab = a - b
    cb = c - b
    # Calculate the angle using arctan2 for the full 0-360° range
    cross = np.cross(ab, cb)
    dot = np.dot(ab, cb)
    angle = np.arctan2(np.linalg.norm(cross), dot)
    angle_deg = np.degrees(angle)
    # Optionally, to always get 0-360 (not just 0-180), you can use the sign of the cross product (for 2D)
    return angle_deg

def is_valid_point(pt):
    return pt is not None and not any(math.isnan(coord) for coord in pt)

def serialize_landmarks(landmarks: list[FrameLandmarks]) -> dict:
        def serialize(obj):
            if isinstance(obj, list):
                return [serialize(item) for item in obj]
            elif hasattr(obj, "__dataclass_fields__"):
                return {k: serialize(getattr(obj, k)) for k in obj.__dataclass_fields__}
            elif isinstance(obj, dict):
                return {k: serialize(v) for k, v in obj.items()}
            else:
                return obj

        return serialize(landmarks)
    
def get_drawing_point(landmarks, index, frame_dims):
    h, w = frame_dims[1], frame_dims[0]
    return int(landmarks.landmarks[index].x * w), int(landmarks.landmarks[index].y * h)

def is_valid_angle(angle):
    return angle is not None and not math.isnan(angle)