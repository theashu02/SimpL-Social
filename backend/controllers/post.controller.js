import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";
import { getSockets, io } from "../socket/socket.js";

export const createPost = async (req, res) => {
	try {
		const { text } = req.body;
		let { img } = req.body;
		const userId = req.user._id.toString();

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if (!text && !img) {
			return res.status(400).json({ error: "Post must have text or image" });
		}

		if (img) {
			const uploadedResponse = await cloudinary.uploader.upload(img);
			img = uploadedResponse.secure_url;
		}

		const newPost = new Post({
			user: userId,
			text,
			img,
		});

		await newPost.save();

		// Populate user details for the new post before sending to clients
		const populatedNewPost = await Post.findById(newPost._id)
			.populate({ path: "user", select: "-password" })
			.populate({ path: "comments.user", select: "-password" }); // Comments will be empty

		// Emit socket event to all clients about the new post
		io.emit("newPostCreated", populatedNewPost);

		// Respond with the populated new post in the HTTP response as well
		res.status(201).json(populatedNewPost);
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
		console.log("Error in createPost controller: ", error);
	}
};

export const deletePost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		if (post.user.toString() !== req.user._id.toString()) {
			return res.status(401).json({ error: "You are not authorized to delete this post" });
		}

		if (post.img) {
			const imgId = post.img.split("/").pop().split(".")[0];
			await cloudinary.uploader.destroy(imgId);
		}

		const postId = req.params.id;
		await Post.findByIdAndDelete(postId);

		io.emit("postDeleted", { postId });

		res.status(200).json({ message: "Post deleted successfully" });
	} catch (error) {
		console.log("Error in deletePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const commentOnPost = async (req, res) => {
	try {
		const { text } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;

		if (!text) {
			return res.status(400).json({ error: "Text field is required" });
		}
		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const comment = { user: userId, text };

		post.comments.push(comment);
		await post.save();

		const populatedPost = await Post.findById(postId)
			.populate({ path: "user", select: "-password" })
			.populate({ path: "comments.user", select: "-password" });

		if (post.user.toString() !== userId.toString()) {
			const newNotification = new Notification({
				type: "comment",
				from: userId,
				to: post.user,
				postId: postId,
			});
			await newNotification.save();

			const populatedNotification = await Notification.findById(newNotification._id)
				.populate({ path: "from", select: "username profileImg" });
			const receiverSocketId = getSockets(post.user.toString());
			if (receiverSocketId) {
				io.to(receiverSocketId).emit("newNotification", populatedNotification);
			}
		}

		io.emit("postCommentUpdate", populatedPost);

		res.status(200).json(populatedPost);
	} catch (error) {
		console.log("Error in commentOnPost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const likeUnlikePost = async (req, res) => {
	try {
		const userId = req.user._id;
		const { id: postId } = req.params;

		let post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const userLikedPost = post.likes.includes(userId);

		if (userLikedPost) {
			// Unlike post
			await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
			await User.updateOne({ _id: userId }, { $pull: { likedPosts: postId } });
		} else {
			// Like post
			post.likes.push(userId);
			await User.updateOne({ _id: userId }, { $push: { likedPosts: postId } });
			await post.save(); // Save the post after adding the like

			// Send notification to the post owner (only on like, not unlike)
			if (post.user.toString() !== userId.toString()) { // Don't notify if liking own post
				const notification = new Notification({
					from: userId,
					to: post.user,
					type: "like",
					postId: postId, // Optional: include postId
				});
				await notification.save();
				
				const receiverSocketId = getSockets(post.user.toString());
				if (receiverSocketId) {
					// Populate 'from' user for the notification before sending via socket
					const populatedNotification = await Notification.findById(notification._id)
						.populate({ path: "from", select: "username profileImg" });
					io.to(receiverSocketId).emit("newNotification", populatedNotification);
				}
			}
		}

		// Fetch the updated and populated post to send to clients
		const updatedAndPopulatedPost = await Post.findById(postId)
			.populate({ path: "user", select: "-password" })
			.populate({ path: "comments.user", select: "-password" });

		// Emit socket event to update the post for all clients
		io.emit("postLikeUpdate", updatedAndPopulatedPost);

		// Send the updated post (or just its likes, or a success message) in the HTTP response
		// Sending the full updated post is consistent
		res.status(200).json(updatedAndPopulatedPost);

	} catch (error) {
		console.log("Error in likeUnlikePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getAllPosts = async (req, res) => {
	try {
		const posts = await Post.find()
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		if (posts.length === 0) {
			return res.status(200).json([]);
		}

		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getAllPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getLikedPosts = async (req, res) => {
	const userId = req.params.id;

	try {
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const likedPosts = await Post.find({ _id: { $in: user.likedPosts } })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(likedPosts);
	} catch (error) {
		console.log("Error in getLikedPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getFollowingPosts = async (req, res) => {
	try {
		const userId = req.user._id;
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const following = user.following;

		const feedPosts = await Post.find({ user: { $in: following } })
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(feedPosts);
	} catch (error) {
		console.log("Error in getFollowingPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getUserPosts = async (req, res) => {
	try {
		const { username } = req.params;

		const user = await User.findOne({ username });
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find({ user: user._id })
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getUserPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
