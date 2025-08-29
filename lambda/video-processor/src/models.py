from dataclasses import dataclass
from typing import Dict

@dataclass
class Landmark:
    x: float
    y: float
    z: float
    visibility: float

@dataclass
class FrameLandmarks:
    frame: int
    landmarks: Dict[str, Landmark]