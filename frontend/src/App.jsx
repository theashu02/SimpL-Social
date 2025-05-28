import { Routes, Route, Navigate } from "react-router-dom";
import SignUpPage from "./pages/auth/signup/SignUpPage";
import LoginPage from "./pages/auth/login/LoginPage";
import HomePage from "./pages/home/HomePage";
import Sidebar from "./components/common/Sidebar";
import RightPanel from "./components/common/RightPanel";
import NotificationPage from "./pages/notification/NotificationPage";
import RoomPage from "./pages/room/RoomPage";
import Redirect from "./pages/redirect/Redirect";
import ProfilePage from "./pages/profile/ProfilePage";
import { Toaster, toast } from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingSpinner from "./components/common/LoadingSpinner";
import { useEffect } from "react";
import { useSocketContext } from "./context/SocketContext.jsx";

function App() {
  const queryClient = useQueryClient();
  const {
    data: authUser,
    isLoading
  } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if(data.error) return null;
        if (!res.ok) {
          throw new Error(data.error || "Something went wrong");
        }
        console.log("authUser is here:", data);
        return data;
      } catch (error) {
        throw new Error(error);
      }
    },
    retry: false,
  });

  const { socket, latestNotification, updatedPostFromSocket, deletedPostIdFromSocket, updatedUserProfileFromSocket, newPostFromSocket } = useSocketContext();

  useEffect(() => {
    if (socket && authUser && authUser._id) {
      socket.emit("registerUser", authUser._id);
    }
  }, [socket, authUser]);

  useEffect(() => {
    if (latestNotification && authUser) {
      let toastMessage = "You have a new notification!";
      let toastIcon = '🔔';

      if (latestNotification.type === 'follow') {
        toastMessage = `@${latestNotification.from.username} started following you`;
        toastIcon = '👥';
      } else if (latestNotification.type === 'like') {
        toastMessage = `Someone liked your post`;
        toastIcon = '❤️';
      } else if (latestNotification.type === 'comment') {
        toastMessage = `@${latestNotification.from.username} commented on your post`;
        toastIcon = '💬';
      }

      toast.success(toastMessage, { icon: toastIcon });
      
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [latestNotification, authUser, queryClient]);

  useEffect(() => {
    if (updatedPostFromSocket) {
      queryClient.setQueryData(["posts"], (oldData) => {
        if (!oldData) return [];
        return oldData.map((p) => {
          if (p._id === updatedPostFromSocket._id) {
            return updatedPostFromSocket;
          }
          return p;
        });
      });
    }
  }, [updatedPostFromSocket, queryClient]);

  useEffect(() => {
    if (deletedPostIdFromSocket) {
      queryClient.setQueryData(["posts"], (oldData) => {
        if (!oldData) return [];
        return oldData.filter((p) => p._id !== deletedPostIdFromSocket);
      });
    }
  }, [deletedPostIdFromSocket, queryClient]);

  useEffect(() => {
    if (updatedUserProfileFromSocket && updatedUserProfileFromSocket.updatedUserToModify) {
      const { updatedUserToModify, updatedCurrentUser } = updatedUserProfileFromSocket;

      const currentProfileData = queryClient.getQueryData(["userProfile"]);
      if (currentProfileData && currentProfileData._id === updatedUserToModify._id) {
        queryClient.setQueryData(["userProfile"], updatedUserToModify);
      }

      if (authUser && updatedCurrentUser && authUser._id === updatedCurrentUser._id) {
        queryClient.setQueryData(["authUser"], updatedCurrentUser);
      }
    }
  }, [updatedUserProfileFromSocket, authUser, queryClient]);

  useEffect(() => {
    if (newPostFromSocket) {
      queryClient.setQueryData(["posts"], (oldData) => {
        if (!oldData) return [newPostFromSocket];
        return [newPostFromSocket, ...oldData];
      });
    }
  }, [newPostFromSocket, queryClient, authUser]);

  if (isLoading) {
    return (
      <div className="h-screen flex justify-center items-center">
        <LoadingSpinner color="red" size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className="flex max-w-6xl mx-auto">
        {authUser && <Sidebar />}
        <Routes>
          <Route
            path="/"
            element={authUser ? <HomePage /> : <Navigate to="/login" />}
          />
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to="/" />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignUpPage /> : <Navigate to="/" />}
          />
          <Route
            path="/notifications"
            element={authUser ? <NotificationPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile/:username"
            element={authUser ? <ProfilePage /> : <Navigate to="/login" />}
          />
          <Route
            path="/RI"
            element={authUser ? <Redirect /> : <Navigate to="/login" />}
          />
          <Route
            path="/room/:roomId"
            element={authUser ? <RoomPage /> : <Navigate to="/login" />}
          />
        </Routes>
        {authUser && <RightPanel />}
        <Toaster />
      </div>
    </>
  );
}

export default App;
