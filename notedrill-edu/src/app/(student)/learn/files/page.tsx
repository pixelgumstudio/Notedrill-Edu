"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FileTile from "@/components/edu/FileTile";
import { studentApi } from "@/lib/student-api";
import { useAuth } from "@/context/AuthContext";
import type { StudentFile } from "@/types/edu";

export default function FilesPage() {
  const [search, setSearch] = useState("");
  const { studentToken } = useAuth();

  const { data: files, isLoading } = useQuery<StudentFile[]>({
    queryKey: ["student-files"],
    queryFn: () => studentApi.getFiles(studentToken ?? ""),
    enabled: !!studentToken,
    staleTime: 60_000,
  });

  const displayedFiles = (files ?? []).filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-5 py-5 md:px-8">
        <h1 className="font-source-serif text-[22px] text-edu-moss-dark">My files</h1>
        <p className="mt-0.5 text-sm text-edu-blue-grey">
          Uploaded by your teachers · {isLoading ? "…" : `${displayedFiles.length} files available`}
        </p>
      </div>

      <div className="px-5 py-6 md:px-8">
        {/* Search */}
        <div className="mb-5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full rounded-lg border-[1.5px] border-edu-line bg-white px-4 py-2.5 text-sm focus:border-edu-moss focus:outline-none sm:max-w-xs"
          />
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-edu-line" />
            ))}
          </div>
        ) : displayedFiles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {displayedFiles.map((file) => (
              <FileTile key={file.id} file={file} href={`/learn/files/${file.id}`} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-edu-blue-grey">
            <div className="mb-3 text-3xl opacity-60">📂</div>
            <p className="text-sm">
              {search ? "No files match your search." : "No files available yet. Check back later."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
