"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, FileText, HelpCircle, Flame, Check, ChevronRight, User, Palette, Headphones, LogOut, TrendingUp, ArrowLeft, Pencil, Camera, CheckCircle } from "lucide-react";
import { DashboardNav } from "../components/DashboardNav";

type ScreenType = "main" | "edit" | "notifications" | "theme" | "help";

export default function ProfilePage() {
  const router = useRouter();

  // Active view state machine
  const [activeScreen, setActiveScreen] = useState<ScreenType>("main");

  // User form states
  const [fullName, setFullName] = useState("Esther John");
  const [emailAddress, setEmailAddress] = useState("estherjohn24@gmail.com");
  const [majorField, setMajorField] = useState("Computer Science & Engineering");

  // Settings toggles states
  const [studyReminders, setStudyReminders] = useState(true);
  const [pushNotes, setPushNotes] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // Theme selection state
  const [selectedTheme, setSelectedTheme] = useState<"midnight" | "obsidian" | "sepia">("midnight");

  // FAQ Accordion open index
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(0);

  // Success toast/message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleOptionClick = (label: string) => {
    if (label === "Logout") {
      router.push("/login");
    } else if (label === "Edit Profile") {
      setActiveScreen("edit");
    } else if (label === "Notification Settings") {
      setActiveScreen("notifications");
    } else if (label === "Theme Preference") {
      setActiveScreen("theme");
    } else if (label === "Help & Support") {
      setActiveScreen("help");
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Profile credentials updated successfully!");
    setActiveScreen("main");
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Notification rules updated successfully!");
    setActiveScreen("main");
  };

  const handleApplyTheme = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(`Applied ${selectedTheme === "midnight" ? "Midnight Black" : selectedTheme === "obsidian" ? "Deep Obsidian" : "Warm Sepia"} theme successfully!`);
    setActiveScreen("main");
  };

  const handleSendHelp = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Support ticket received! We will reply via email.");
    setActiveScreen("main");
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col md:flex-row pb-28 md:pb-0">
      
      {/* Sidebar Navigation */}
      <DashboardNav />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col max-w-[480px] mx-auto w-full p-4 sm:p-6 md:py-8 justify-start gap-5 relative">
        
        {/* Absolute Toast alert notification popup */}
        {toastMessage && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-[#131313] border border-[#f3c494]/30 px-4 py-2.5 rounded-full flex items-center gap-2 z-50 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle className="h-4 w-4 text-[#f3c494]" />
            <span className="text-[11px] sm:text-xs font-black text-white">{toastMessage}</span>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: MAIN PROFILE VIEW CONTAINER */}
        {/* ---------------------------------------------------- */}
        {activeScreen === "main" && (
          <>
            {/* Top Header bar with Bell */}
            <header className="flex items-center justify-end w-full relative">
              <button className="relative flex items-center justify-center h-10 w-10 rounded-full bg-[#131313] border border-white/5 hover:bg-white/5 hover:border-white/10 transition shrink-0 select-none">
                <Bell className="h-4.5 w-4.5 text-white" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#ef6868]" />
              </button>
            </header>

            {/* Glowing Avatar & Name Details */}
            <section className="flex flex-col items-center text-center gap-3 mt-1.5 select-none">
              <div className="relative">
                <span className="absolute -top-3 -left-3 text-[#f3c494] text-xs opacity-60 animate-pulse font-mono">*</span>
                <span className="absolute -top-1 -right-4 text-[#f3c494] text-sm opacity-55 animate-pulse font-mono">*</span>
                <span className="absolute bottom-2 -left-5 text-[#f3c494] text-[10px] opacity-50 animate-pulse font-mono">*</span>
                <span className="absolute bottom-4 -right-5 text-[#f3c494] text-xs opacity-45 animate-pulse font-mono">*</span>

                <div className="h-[96px] w-[96px] rounded-full p-[3px] bg-gradient-to-tr from-[#f3c494]/30 via-[#f3c494]/90 to-[#f3c494]/20 shadow-[0_0_20px_rgba(243,196,148,0.25)] flex items-center justify-center">
                  <div className="h-full w-full rounded-full overflow-hidden bg-[#181818] border border-black/80">
                    <img
                      src="/avatar.png"
                      alt="Esther John Profile Avatar"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setActiveScreen("edit")}
                  className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-[#f3c494] hover:bg-[#e0a96d] flex items-center justify-center text-[#3e230d] transition shadow shadow-black/60 cursor-pointer focus:outline-none"
                >
                  <Pencil className="h-3 w-3 fill-current" />
                </button>
              </div>

              <div className="flex flex-col gap-0.5 mt-1">
                <h2 className="text-lg font-black text-white tracking-wide">
                  {fullName}
                </h2>
                <span className="text-xs text-text-muted font-medium">
                  {emailAddress}
                </span>
              </div>
            </section>

            {/* STUDY STATISTICS CARD */}
            <section className="w-full bg-[#131313] border border-white/5 rounded-3xl p-5 flex flex-col gap-4 shadow-md shadow-black/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
                  Study Statistics
                </h3>
                <div className="h-7 w-7 rounded-lg bg-[#202020] flex items-center justify-center text-[#f3c494]">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 mt-1 text-center items-stretch justify-around">
                <div className="flex flex-col items-center justify-between py-1">
                  <div className="h-9 w-9 rounded-full bg-[#f3c494]/10 flex items-center justify-center text-[#f3c494]">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-lg font-black text-[#f3c494] mt-2.5 leading-none">24</span>
                  <span className="text-[9px] font-bold text-text-muted mt-2 leading-tight max-w-[72px]">
                    Documents Uploaded
                  </span>
                </div>
                <div className="w-[1px] bg-white/5 h-20 self-center mx-auto" />
                <div className="flex flex-col items-center justify-between py-1">
                  <div className="h-9 w-9 rounded-full bg-[#f3c494]/10 flex items-center justify-center text-[#f3c494]">
                    <HelpCircle className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-lg font-black text-[#f3c494] mt-2.5 leading-none">38</span>
                  <span className="text-[9px] font-bold text-text-muted mt-2 leading-tight max-w-[72px]">
                    Quizzes Taken
                  </span>
                </div>
                <div className="w-[1px] bg-white/5 h-20 self-center mx-auto" />
                <div className="flex flex-col items-center justify-between py-1">
                  <div className="h-9 w-9 rounded-full bg-[#f3c494]/10 flex items-center justify-center text-[#f3c494]">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-lg font-black text-[#f3c494] mt-2.5 leading-none">16</span>
                  <span className="text-[9px] font-bold text-text-muted mt-2 leading-tight max-w-[72px]">
                    Summaries Generated
                  </span>
                </div>
              </div>
            </section>

            {/* STUDY STREAK CARD */}
            <section className="w-full bg-[#131313] border border-white/5 rounded-3xl p-5 flex flex-col gap-5 shadow-md shadow-black/20">
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full border-2 border-[#f3c494] bg-[#f3c494]/10 flex items-center justify-center text-[#f3c494] shadow shadow-[#f3c494]/10">
                    <Flame className="h-6 w-6 fill-current" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-xs sm:text-sm font-extrabold text-white leading-none">
                      Study Streak
                    </h4>
                    <p className="text-[10px] sm:text-xs text-text-muted leading-none">
                      You're on fire! Keep it up.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end leading-none">
                  <span className="text-xl font-black text-[#f3c494]">7</span>
                  <span className="text-[9px] font-bold text-[#f3c494] mt-1 uppercase tracking-wider">Days</span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full mt-1.5">
                {[
                  { day: "Mon", active: true },
                  { day: "Tue", active: true },
                  { day: "Wed", active: true },
                  { day: "Thu", active: true },
                  { day: "Fri", active: true },
                  { day: "Sat", active: true },
                  { day: "Sun", active: false },
                ].map((streak, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    {streak.active ? (
                      <div className="h-7 w-7 rounded-full bg-[#f3c494] flex items-center justify-center text-[#3e230d] shadow shadow-[#f3c494]/10">
                        <Check className="h-4 w-4 stroke-[3px]" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-transparent border border-white/10 flex items-center justify-center" />
                    )}
                    <span className="text-[9px] font-bold text-text-muted">
                      {streak.day}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* NAVIGATION MENU LIST */}
            <section className="w-full bg-[#131313] border border-white/5 rounded-3xl p-2.5 flex flex-col gap-0.5 shadow-md shadow-black/20">
              {[
                { label: "Edit Profile", icon: User },
                { label: "Notification Settings", icon: Bell },
                { label: "Theme Preference", icon: Palette },
                { label: "Help & Support", icon: Headphones },
                { label: "Logout", icon: LogOut },
              ].map((item, idx, arr) => {
                const Icon = item.icon;
                const isLogout = item.label === "Logout";
                return (
                  <div key={item.label} className="w-full">
                    <button
                      onClick={() => handleOptionClick(item.label)}
                      className="w-full flex items-center justify-between py-3.5 px-3 rounded-2xl hover:bg-white/5 transition cursor-pointer text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          isLogout
                            ? "bg-[#ef6868]/15 text-[#ef6868]"
                            : "bg-[#f3c494]/10 text-[#f3c494]"
                        }`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <span className={`text-xs sm:text-sm font-extrabold ${isLogout ? "text-[#ef6868]" : "text-white"}`}>
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className={`h-4.5 w-4.5 shrink-0 ${isLogout ? "text-[#ef6868]/60" : "text-text-muted"}`} />
                    </button>
                    {idx < arr.length - 1 && (
                      <div className="h-[1px] w-[92%] mx-auto bg-white/5" />
                    )}
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 2: EDIT PROFILE SUB-SCREEN */}
        {/* ---------------------------------------------------- */}
        {activeScreen === "edit" && (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-5.5 w-full animate-in fade-in duration-200">
            {/* Header subroute title */}
            <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveScreen("main")}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#131313] border border-white/5 hover:bg-white/5 hover:border-white/10 transition shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-white" />
              </button>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Edit Profile
              </h1>
            </header>

            {/* Change Profile image layout */}
            <div className="flex flex-col items-center gap-3 my-2 text-center select-none">
              <div className="relative">
                <div className="h-[96px] w-[96px] rounded-full p-[3px] bg-gradient-to-tr from-[#f3c494]/30 via-[#f3c494]/90 to-[#f3c494]/20 shadow-[0_0_20px_rgba(243,196,148,0.25)] flex items-center justify-center">
                  <div className="h-full w-full rounded-full overflow-hidden bg-[#181818]">
                    <img
                      src="/avatar.png"
                      alt="Avatar"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alert("Photo pick triggers!")}
                  className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[#f3c494] hover:bg-[#e0a96d] flex items-center justify-center text-[#3e230d] shadow transition"
                >
                  <Camera className="h-3.5 w-3.5 fill-current" />
                </button>
              </div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Tap camera to change photo
              </span>
            </div>

            {/* Inputs list form */}
            <div className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-wider px-1">
                  Full Name
                </label>
                <div className="w-full bg-[#131313] border border-white/5 rounded-2xl p-3 px-4 flex items-center">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white font-extrabold focus:ring-0 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-wider px-1">
                  Email Address
                </label>
                <div className="w-full bg-[#131313]/50 border border-white/5 rounded-2xl p-3 px-4 flex items-center opacity-85 select-none">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-text-muted font-bold cursor-not-allowed focus:ring-0 focus:outline-none"
                    disabled
                  />
                </div>
              </div>

              {/* Major Discipline */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-wider px-1">
                  Study Major / Institution
                </label>
                <div className="w-full bg-[#131313] border border-white/5 rounded-2xl p-3 px-4 flex items-center">
                  <input
                    type="text"
                    value={majorField}
                    onChange={(e) => setMajorField(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white font-extrabold focus:ring-0 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Action Save Buttons */}
            <div className="flex flex-col gap-2.5 mt-5">
              <button
                type="submit"
                className="w-full py-4 bg-[#f3c494] hover:bg-[#e0a96d] text-[#3e230d] font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center transition shadow cursor-pointer select-none"
              >
                Save Profile Changes
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen("main")}
                className="w-full py-4 bg-transparent hover:bg-white/5 border border-white/10 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center transition cursor-pointer select-none"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 3: NOTIFICATION SETTINGS SUB-SCREEN */}
        {/* ---------------------------------------------------- */}
        {activeScreen === "notifications" && (
          <form onSubmit={handleSaveNotifications} className="flex flex-col gap-5.5 w-full animate-in fade-in duration-200">
            <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveScreen("main")}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#131313] border border-white/5 hover:bg-white/5 hover:border-white/10 transition shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-white" />
              </button>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Notifications
              </h1>
            </header>

            {/* Toggles Panel */}
            <div className="w-full bg-[#131313] border border-white/5 rounded-3xl p-5 flex flex-col gap-5 shadow-sm">
              {/* Toggle 1: AI Study Reminders */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5 max-w-[70%]">
                  <span className="text-xs sm:text-sm font-extrabold text-white">AI Study Reminders</span>
                  <span className="text-[10px] text-text-muted leading-tight">Get push alerts on incomplete quiz schedules</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStudyReminders(!studyReminders)}
                  className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer outline-none focus:outline-none ${
                    studyReminders ? "bg-[#f3c494]" : "bg-[#181818] border border-white/10"
                  }`}
                >
                  <div
                    className={`h-4.5 w-4.5 rounded-full shadow transition-transform ${
                      studyReminders ? "translate-x-5 bg-[#3e230d]" : "translate-x-0 bg-text-muted"
                    }`}
                  />
                </button>
              </div>

              <div className="h-[1px] w-full bg-white/5" />

              {/* Toggle 2: Upload Push alerts */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5 max-w-[70%]">
                  <span className="text-xs sm:text-sm font-extrabold text-white">Push Announcements</span>
                  <span className="text-[10px] text-text-muted leading-tight">Get warnings when AI finishes document parsing</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPushNotes(!pushNotes)}
                  className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer outline-none focus:outline-none ${
                    pushNotes ? "bg-[#f3c494]" : "bg-[#181818] border border-white/10"
                  }`}
                >
                  <div
                    className={`h-4.5 w-4.5 rounded-full shadow transition-transform ${
                      pushNotes ? "translate-x-5 bg-[#3e230d]" : "translate-x-0 bg-text-muted"
                    }`}
                  />
                </button>
              </div>

              <div className="h-[1px] w-full bg-white/5" />

              {/* Toggle 3: Email Digests */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5 max-w-[70%]">
                  <span className="text-xs sm:text-sm font-extrabold text-white">Weekly Study Progress</span>
                  <span className="text-[10px] text-text-muted leading-tight">Receive email digests outlining streak activity metrics</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWeeklyDigest(!weeklyDigest)}
                  className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer outline-none focus:outline-none ${
                    weeklyDigest ? "bg-[#f3c494]" : "bg-[#181818] border border-white/10"
                  }`}
                >
                  <div
                    className={`h-4.5 w-4.5 rounded-full shadow transition-transform ${
                      weeklyDigest ? "translate-x-5 bg-[#3e230d]" : "translate-x-0 bg-text-muted"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 mt-5">
              <button
                type="submit"
                className="w-full py-4 bg-[#f3c494] hover:bg-[#e0a96d] text-[#3e230d] font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center transition shadow cursor-pointer select-none"
              >
                Save Notification Rules
              </button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 4: THEME PREFERENCE SUB-SCREEN */}
        {/* ---------------------------------------------------- */}
        {activeScreen === "theme" && (
          <form onSubmit={handleApplyTheme} className="flex flex-col gap-5.5 w-full animate-in fade-in duration-200">
            <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveScreen("main")}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#131313] border border-white/5 hover:bg-white/5 hover:border-white/10 transition shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-white" />
              </button>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Theme Preference
              </h1>
            </header>

            {/* Theme Select Grid Cards */}
            <div className="grid grid-cols-1 gap-3.5 w-full">
              {/* Option 1: Midnight Black */}
              <div
                onClick={() => setSelectedTheme("midnight")}
                className={`bg-[#131313] rounded-3xl p-4.5 flex items-center justify-between border cursor-pointer select-none transition ${
                  selectedTheme === "midnight"
                    ? "border-[#f3c494] shadow-[0_0_15px_rgba(243,196,148,0.1)]"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-7 w-7 rounded-full bg-[#080808] border border-[#f3c494]/30 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-extrabold text-white">Midnight Black</span>
                    <span className="text-[10px] text-text-muted">Pitch black palette, gold accenting</span>
                  </div>
                </div>
                {selectedTheme === "midnight" && (
                  <Check className="h-4 w-4 text-[#f3c494] stroke-[3px]" />
                )}
              </div>

              {/* Option 2: Obsidian Charcoal */}
              <div
                onClick={() => setSelectedTheme("obsidian")}
                className={`bg-[#131313] rounded-3xl p-4.5 flex items-center justify-between border cursor-pointer select-none transition ${
                  selectedTheme === "obsidian"
                    ? "border-[#f3c494] shadow-[0_0_15px_rgba(243,196,148,0.1)]"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-7 w-7 rounded-full bg-[#181818] border border-white/10 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-extrabold text-white">Obsidian Charcoal</span>
                    <span className="text-[10px] text-text-muted">Dark grey palette, gold elements</span>
                  </div>
                </div>
                {selectedTheme === "obsidian" && (
                  <Check className="h-4 w-4 text-[#f3c494] stroke-[3px]" />
                )}
              </div>

              {/* Option 3: Warm Sepia */}
              <div
                onClick={() => setSelectedTheme("sepia")}
                className={`bg-[#131313] rounded-3xl p-4.5 flex items-center justify-between border cursor-pointer select-none transition ${
                  selectedTheme === "sepia"
                    ? "border-[#f3c494] shadow-[0_0_15px_rgba(243,196,148,0.1)]"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-7 w-7 rounded-full bg-[#1d1916] border border-[#f3c494]/20 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-extrabold text-white">Warm Sepia</span>
                    <span className="text-[10px] text-text-muted">Cozy warm aesthetics, orange-gold</span>
                  </div>
                </div>
                {selectedTheme === "sepia" && (
                  <Check className="h-4 w-4 text-[#f3c494] stroke-[3px]" />
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 mt-5">
              <button
                type="submit"
                className="w-full py-4 bg-[#f3c494] hover:bg-[#e0a96d] text-[#3e230d] font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center transition shadow cursor-pointer select-none"
              >
                Apply Theme Mode
              </button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 5: HELP & SUPPORT SUB-SCREEN */}
        {/* ---------------------------------------------------- */}
        {activeScreen === "help" && (
          <div className="flex flex-col gap-5.5 w-full animate-in fade-in duration-200">
            <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveScreen("main")}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#131313] border border-white/5 hover:bg-white/5 hover:border-white/10 transition shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-white" />
              </button>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Help & Support
              </h1>
            </header>

            {/* FAQs expanding Accordion */}
            <section className="flex flex-col gap-3 w-full">
              <h3 className="text-xs font-black text-[#f3c494] uppercase tracking-wider px-1">
                Frequently Asked Questions
              </h3>

              <div className="flex flex-col gap-2.5 mt-1.5">
                {[
                  {
                    q: "How do I upload a document?",
                    a: "Navigate to the Upload tab on bottom bar or sidebar, drag your PDF into the dashed container, type in the subject name, and confirm uploads to start studying!",
                  },
                  {
                    q: "How are quizzes generated?",
                    a: "Our AI systems index matching text lines and concepts within study guides, creating rich high-fidelity multiple-choice setups syncing to active count selector rules (5, 10, 15, 20).",
                  },
                  {
                    q: "Can I download study summaries?",
                    a: "Yes! You can copy text contents from Cheat Sheets, study cards definitions inside virtual Flashcard decks, or inspect hierarchical nodes directly inside interactive Mind Maps.",
                  },
                ].map((faq, idx) => {
                  const isOpen = faqOpenIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-[#131313] border border-white/5 rounded-2xl overflow-hidden transition"
                    >
                      <button
                        type="button"
                        onClick={() => setFaqOpenIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-4 text-left cursor-pointer focus:outline-none"
                      >
                        <span className="text-xs sm:text-sm font-extrabold text-white leading-relaxed pr-2">
                          {faq.q}
                        </span>
                        <ChevronRight className={`h-4.5 w-4.5 text-text-muted shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-90 text-[#f3c494]" : ""
                        }`} />
                      </button>

                      {isOpen && (
                        <div className="p-4 pt-0 text-[11px] sm:text-xs text-text-muted leading-relaxed border-t border-white/5/5 bg-[#181818]/40 animate-in fade-in duration-200">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Contact ticket form */}
            <form onSubmit={handleSendHelp} className="flex flex-col gap-3.5 w-full mt-2.5">
              <h3 className="text-xs font-black text-[#f3c494] uppercase tracking-wider px-1">
                Send Support Ticket
              </h3>

              <div className="flex flex-col gap-2.5">
                <textarea
                  placeholder="How can we help? Explain your issue here..."
                  className="w-full h-24 bg-[#131313] border border-white/5 rounded-2xl p-3.5 text-xs sm:text-sm text-white placeholder:text-text-muted focus:ring-0 focus:outline-none resize-none"
                  required
                />
                
                <button
                  type="submit"
                  className="w-full py-4 bg-[#f3c494] hover:bg-[#e0a96d] text-[#3e230d] font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center transition shadow cursor-pointer select-none"
                >
                  Send Support Message
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
