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

        return () => {
            newSocket.close();
            setSocket(null);
        };
    }, []);

    const clearUnreadNotificationCount = () => {
        setUnreadNotificationCount(0);
    };

    return <SocketContext.Provider value={{ socket, onlineUsers, unreadNotificationCount, latestNotification, clearUnreadNotificationCount }}>{children}</SocketContext.Provider>;
};

SocketContextProvider.propTypes = {
    children: PropTypes.node.isRequired,
}; 