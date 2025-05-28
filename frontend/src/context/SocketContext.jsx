import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from 'prop-types';
import io from "socket.io-client";

const SocketContext = createContext();

export const useSocketContext = () => {
    return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [latestNotification, setLatestNotification] = useState(null);
    const [updatedPostFromSocket, setUpdatedPostFromSocket] = useState(null);
    const [deletedPostIdFromSocket, setDeletedPostIdFromSocket] = useState(null);
    const [updatedUserProfileFromSocket, setUpdatedUserProfileFromSocket] = useState(null);
    const [newPostFromSocket, setNewPostFromSocket] = useState(null);

    useEffect(() => {
        const newSocket = io("http://localhost:5000");
        setSocket(newSocket);

        newSocket.on("getOnlineUsers", (users) => {
            setOnlineUsers(users);
        });

        newSocket.on("newNotification", (notification) => {
            setLatestNotification(notification);
            setUnreadNotificationCount(prevCount => prevCount + 1);
        });

        newSocket.on("postCommentUpdate", (updatedPost) => {
            setUpdatedPostFromSocket(updatedPost);
        });

        newSocket.on("postDeleted", (data) => {
            setDeletedPostIdFromSocket(data.postId);
        });

        newSocket.on("postLikeUpdate", (updatedPost) => {
            setUpdatedPostFromSocket(updatedPost);
        });

        newSocket.on("userProfileUpdate", (data) => {
            setUpdatedUserProfileFromSocket(data);
        });

        newSocket.on("newPostCreated", (newPost) => {
            setNewPostFromSocket(newPost);
        });

        return () => {
            newSocket.close();
            setSocket(null);
        };
    }, []);

    const clearUnreadNotificationCount = () => {
        setUnreadNotificationCount(0);
    };

    return <SocketContext.Provider value={{ socket, onlineUsers, unreadNotificationCount, latestNotification, clearUnreadNotificationCount, updatedPostFromSocket, deletedPostIdFromSocket, updatedUserProfileFromSocket, newPostFromSocket }}>{children}</SocketContext.Provider>;
};

SocketContextProvider.propTypes = {
    children: PropTypes.node.isRequired,
}; 