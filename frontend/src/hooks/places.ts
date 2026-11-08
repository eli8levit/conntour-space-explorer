import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

/** Every image's place, in one light list. Used by the 3D scene. */
export function usePlaces() {
  return useQuery({
    queryKey: ["places"],
    queryFn: api.listPlaces,
    staleTime: Infinity, // places are hand-reviewed data, fixed at seed time
  });
}
