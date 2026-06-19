import * as Location from "expo-location";

export interface Position {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

/** Request permission (if needed) and return a single high-accuracy fix. */
export async function getCurrentPosition(): Promise<Position> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission is required to check in or out.");
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
  };
}
