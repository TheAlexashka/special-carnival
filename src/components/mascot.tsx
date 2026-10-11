"use client";

import React from "react";

export function YarnProgress({
  percent,
  active = true,
  caption,
  captionRight,
}: {
  percent: number;
  active?: boolean;
  caption?: React.ReactNode;
  captionRight?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="yarn-progress" aria-live="polite">
      <div className="yarn-progress__track-wrap">
        <span className={`yarn-progress__ball ${active ? "is-rolling" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 40 40" width="34" height="34">
            <circle cx="20" cy="19" r="13" className="yb-fill" />
            <path d="M9 15c5-4 15-4 22 0M7.5 20c6-4.5 18-4.5 25 0M9 25c5 4 15 4 22 0M14 7.5c-2.7 7.5-2.7 15.5 0 23M20 6.5c-3.3 8.3-3.3 16.7 0 25M26 7.5c2.7 7.5 2.7 15.5 0 23" className="yb-wrap" />
          </svg>
        </span>
        <div className="yarn-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
          <div className={`yarn-progress__thread ${active ? "is-flowing" : ""}`} style={{ width: `${Math.max(6, clamped)}%` }}>
            <span className="yarn-progress__curl" aria-hidden="true" />
          </div>
        </div>
        <span className="yarn-progress__pct">{clamped}%</span>
      </div>
      {(caption || captionRight) && (
        <div className="yarn-progress__caption"><span className="yarn-progress__caption-left">{caption}</span><span>{captionRight}</span></div>
      )}
    </div>
  );
}

export function KittenChase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 210" className={className || "kitten-chase"} role="img" aria-label="Котёнок догоняет клубок ниток">
      <ellipse cx="170" cy="188" rx="130" ry="10" className="ks-floor" />
      <path d="M40 186C80 176 96 192 128 184s48-4 70 2 48 4 64-2" className="ks-thread" />
      <g className="ks-ball">
        <circle cx="284" cy="168" r="22" className="ks-ball-fill" />
        <path d="M264 160c12-8 28-8 40 0m-42 10c13-9 31-9 44 0m-42 10c12 8 28 8 40 0m-30-32c-5 13-5 27 0 40m12-42c-7 15-7 29 0 44m10-40c-5 12-5 24 0 36" className="ks-ball-wrap" />
        <circle cx="276" cy="160" r="2.4" className="ks-ball-shine" />
      </g>
      <g className="ks-kitten">
        <path d="M78 150C52 146 42 126 50 106c2-6 10-6 12 0-6 16 2 30 20 34Z" className="ks-tail ks-kit2" />
        <ellipse cx="92" cy="150" rx="22" ry="20" className="ks-kit" />
        <ellipse cx="86" cy="170" rx="14" ry="8" className="ks-kit" />
        <path d="M86 128c0-22 26-32 48-26 20 6 28 22 24 40-4 18-22 26-42 22-20-4-30-16-30-36Z" className="ks-kit" />
        <path d="M104 104q6 14-2 26m20-28q6 14-2 26" className="ks-stripe" />
        <g className="ks-paw"><path d="M152 138c18-2 32 2 44 12l-2 8c-12-6-26-8-42-8Z" className="ks-kit" /><ellipse cx="197" cy="155" rx="9" ry="7.5" className="ks-kit" /></g>
        <ellipse cx="150" cy="166" rx="13" ry="8" className="ks-kit" />
        <g className="ks-head">
          <path d="m150 74-4-28 24 16Zm36-12 24-16-4 28Z" className="ks-kit" />
          <path d="m152 68-2-14 12 8Zm38-6 12-8-2 14Z" className="ks-ear-inner" />
          <circle cx="178" cy="88" r="30" className="ks-kit" />
          <path d="M172 60q2 6 0 10m8-11q2 6 0 10m8-8q2 6 0 9" className="ks-stripe" />
          <g className="ks-eye"><ellipse cx="167" cy="86" rx="6.4" ry="7.4" className="ks-eyeball" /><circle cx="169" cy="83.5" r="2.2" className="ks-shine" /></g>
          <g className="ks-eye"><ellipse cx="193" cy="86" rx="6.4" ry="7.4" className="ks-eyeball" /><circle cx="195" cy="83.5" r="2.2" className="ks-shine" /></g>
          <ellipse cx="158" cy="99" rx="5.4" ry="3" className="ks-blush" /><ellipse cx="198" cy="99" rx="5.4" ry="3" className="ks-blush" />
          <path d="M178 95c-3 0-4 2-2 3 2 1 2 1 4 0 2-1 1-3-2-3Z" className="ks-nose" /><path d="M174 101q4 3 8 0" className="ks-mouth" />
          <path d="m150 92-20-4m20 10-19 2m75-8 20-4m-20 10 19 2" className="ks-whisker" />
        </g>
        <g><path d="M210 46c7-7 15-5 15 2 0 6-7 8-12 4Zm0 0c-7-7-15-5-15 2 0 6 7 8 12 4Z" className="ks-bow-fill" /><circle cx="210" cy="48" r="3.6" className="ks-bow-knot" /></g>
      </g>
      <path d="M116 44c-3-6-12-6-12 1 0 5 6 8 12 13 6-5 12-8 12-13 0-7-9-7-12-1Z" className="ks-heart" />
      <path d="M226 30c-2-5-10-5-10 1 0 4 5 6 10 10 5-4 10-6 10-10 0-6-8-6-10-1Z" className="ks-heart ks-heart--2" />
      <path d="m64 40 3 5 5 3-5 3-3 5-3-5-5-3 5-3Z" className="ks-sparkle" />
    </svg>
  );
}

export function KittenSleep({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className || "kitten-sleep"} role="img" aria-label="Спящий котёнок с клубком">
      <circle cx="186" cy="118" r="26" className="ks-ball-fill" />
      <path d="M162 112c15-11 33-11 48 0m-50 11c16-12 35-12 51 0m-47 11c14 10 31 10 45 0m-31-40c-7 16-7 33 0 49m13-51c-9 17-9 35 0 52" className="ks-ball-wrap" />
      <path d="M152 128c-18 2-28-2-34-10" className="ks-thread" />
      <path d="M44 118c0-26 26-42 56-38s48 20 48 42c0 16-18 26-48 26-32 0-56-8-56-30Z" className="ks-kit" />
      <path d="M147 128c10 10 6 20-8 20-12 0-20-6-18-14" className="ks-tail-2" />
      <path d="m74 78-6-22 20 12Zm34-12 22-12-4 22Z" className="ks-kit" /><circle cx="100" cy="96" r="27" className="ks-kit" />
      <path d="M84 94q6 6 12 0m8 0q6 6 12 0" className="ks-eye-closed" />
      <ellipse cx="86" cy="104" rx="4.6" ry="2.6" className="ks-blush" /><ellipse cx="116" cy="104" rx="4.6" ry="2.6" className="ks-blush" />
      <path d="M100 101c-2 0-3 1-2 3 2 1 2 1 4 0 1-2 0-3-2-3Z" className="ks-nose" /><path d="M96 106q4 3 8 0" className="ks-mouth" />
      <text x="140" y="52" className="ks-z ks-z--1">z</text><text x="156" y="38" className="ks-z ks-z--2">z</text><text x="174" y="22" className="ks-z ks-z--3">Z</text>
    </svg>
  );
}

export function KittenRun({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 84" className={className || "kitten-run"} aria-hidden="true">
      <g className="kr-body">
        <path d="M40 52c0-12 14-18 26-14s16 14 12 22-18 10-28 6c-7-3-10-8-10-14Z" className="ks-kit" />
        <g className="kr-leg"><path d="m48 62-4 12" className="ks-limb" /></g><g className="kr-leg kr-leg--2"><path d="m58 64 0 12" className="ks-limb" /></g><g className="kr-leg kr-leg--3"><path d="m68 64 4 12" className="ks-limb" /></g>
        <path d="M42 48c-12-2-16-12-12-20" className="kr-tail" />
        <path d="m84 36-3-16 13 10Zm20-6 13-10-3 16Z" className="ks-kit" /><circle cx="97" cy="40" r="14" className="ks-kit" />
        <circle cx="92" cy="40" r="2.6" className="ks-eyeball" /><circle cx="103" cy="40" r="2.6" className="ks-eyeball" />
        <path d="M97 46c-1 0-2 1-1 2h2c1-1 0-2-1-2Z" className="ks-nose" />
      </g>
    </svg>
  );
}
