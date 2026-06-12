"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export function FavoriteButton({ problemId }: { problemId: string }) {
  const { data: session } = useSession();
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) { setLoading(false); return; }
    fetch("/api/favorites")
      .then((r) => r.ok ? r.json() : { ids: [] })
      .then((data: { ids: string[] }) => {
        setFavorited(data.ids.includes(problemId));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, problemId]);

  if (!session?.user) return null;

  const toggle = async () => {
    const prev = favorited;
    setFavorited(!prev); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId }),
      });
      if (res.ok) {
        const data: { favorited: boolean } = await res.json();
        setFavorited(data.favorited);
      } else {
        setFavorited(prev); // revert
      }
    } catch {
      setFavorited(prev); // revert
    }
  };

  return (
    <button
      className={`btn small fav-btn${favorited ? " active" : ""}`}
      onClick={toggle}
      disabled={loading}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      {favorited ? "★" : "☆"}
    </button>
  );
}
