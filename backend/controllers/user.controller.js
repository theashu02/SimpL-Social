import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";

// models
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { getSockets, io } from "../socket/socket.js";

export const getUserProfile = async (req, res) => {
	const { username } = req.params;

	try {
		const user = await User.findOne({ username }).select("-password");
		if (!user) return res.status(404).json({ message: "User not found" });

		res.status(200).json(user);
	} catch (error) {
		console.log("Error in getUserProfile: ", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const followUnfollowUser = async (req, res) => {
	try {
		const { id: userToModifyId } = req.params;
		const currentUserId = req.user._id;

		if (userToModifyId === currentUserId.toString()) {
			return res.status(400).json({ error: "You can't follow/unfollow yourself" });
		}

		let userToModify = await User.findById(userToModifyId);
		let currentUser = await User.findById(currentUserId);

		if (!userToModify || !currentUser) return res.status(400).json({ error: "User not found" });

		const isFollowing = currentUser.following.includes(userToModifyId);

		if (isFollowing) {
			// Unfollow the user
			await User.findByIdAndUpdate(userToModifyId, { $pull: { followers: currentUserId } });
			await User.findByIdAndUpdate(currentUserId, { $pull: { following: userToModifyId } });
			// No notification needed for unfollow
		} else {
			// Follow the user
			await User.findByIdAndUpdate(userToModifyId, { $push: { followers: currentUserId } });
			await User.findByIdAndUpdate(currentUserId, { $push: { following: userToModifyId } });
			
			// Send notification to the user being followed
			const newNotification = new Notification({
				type: "follow",
				from: currentUserId,
				to: userToModifyId,
			});
			await newNotification.save();

			const receiverSocketId = getSockets(userToModifyId);
			if (receiverSocketId) {
				// Populate 'from' user for the notification before sending via socket
				const populatedNotification = await Notification.findById(newNotification._id)
					.populate({ path: "from", select: "username profileImg" });
				io.to(receiverSocketId).emit("newNotification", populatedNotification);
			}
		}

		// Fetch updated user data for both users
		const updatedUserToModify = await User.findById(userToModifyId).select("-password");
		const updatedCurrentUser = await User.findById(currentUserId).select("-password");

		// Emit socket event with both updated user profiles
		io.emit("userProfileUpdate", { updatedUserToModify, updatedCurrentUser });

		// Send a success message or the updated current user (e.g., for their following list)
		res.status(200).json({ 
			message: isFollowing ? "User unfollowed successfully" : "User followed successfully",
			updatedCurrentUser // Optional: send back updated current user
		});
	} catch (error) {
		console.log("Error in followUnfollowUser: ", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const getSuggestedUsers = async (req, res) => {
	try {
		const userId = req.user._id;

		const usersFollowedByMe = await User.findById(userId).select("following");

		const users = await User.aggregate([
			{
				$match: {
					_id: { $ne: userId },
				},
			},
			{ $sample: { size: 10 } },
		]);

		// 1,2,3,4,5,6,
		const filteredUsers = users.filter((user) => !usersFollowedByMe.following.includes(user._id));
		const suggestedUsers = filteredUsers.slice(0, 4);

		suggestedUsers.forEach((user) => (user.password = null));

		res.status(200).json(suggestedUsers);
	} catch (error) {
		console.log("Error in getSuggestedUsers: ", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const updateUser = async (req, res) => {
	const { fullName, email, username, currentPassword, newPassword, bio, link } = req.body;
	let { profileImg, coverImg } = req.body;

	const userId = req.user._id;

	try {
		let user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if ((!newPassword && currentPassword) || (!currentPassword && newPassword)) {
			return res.status(400).json({ error: "Please provide both current password and new password" });
		}

		if (currentPassword && newPassword) {
			const isMatch = await bcrypt.compare(currentPassword, user.password);
			if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });
			if (newPassword.length < 6) {
				return res.status(400).json({ error: "Password must be at least 6 characters long" });
			}

			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(newPassword, salt);
		}

		if (profileImg) {
			if (user.profileImg) {
				// https://res.cloudinary.com/dyfqon1v6/image/upload/v1712997552/zmxorcxexpdbh8r0bkjb.png
				await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0]);
			}

			const uploadedResponse = await cloudinary.uploader.upload(profileImg);
			profileImg = uploadedResponse.secure_url;
		}

		if (coverImg) {
			if (user.coverImg) {
				await cloudinary.uploader.destroy(user.coverImg.split("/").pop().split(".")[0]);
			}

			const uploadedResponse = await cloudinary.uploader.upload(coverImg);
			coverImg = uploadedResponse.secure_url;
		}

		user.fullName = fullName || user.fullName;
		user.email = email || user.email;
		user.username = username || user.username;
		user.bio = bio || user.bio;
		user.link = link || user.link;
		user.profileImg = profileImg || user.profileImg;
		user.coverImg = coverImg || user.coverImg;

		user = await user.save();

		// password should be null in response
		user.password = null;

		return res.status(200).json(user);
	} catch (error) {
		console.log("Error in updateUser: ", error.message);
		res.status(500).json({ error: error.message });
	}
};
