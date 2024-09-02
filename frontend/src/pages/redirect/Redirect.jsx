import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Redirect() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  // const now = new Date();


  const handleJoinRoom = useCallback(() => {
    if (value.trim() && value==currentYear) {
      navigate(`/room/${value}`);
      toast.success("Joining room...");
    } else {
      toast.error("Please enter a valid room code.");
    }
  }, [navigate, value, currentYear]);

  return (
    <div className="w-full flex flex-col justify-center items-center border-double space-y-10 text-slate-100">
      <h1 className="font-mono text-lg text-red-600">Disclaimer</h1>
      <h1 className="text-lg text-blue-300 font-mono">
        Public ChatRoom Code: {currentYear}
      </h1>
      <div className="flex text-center text-gray-400 font-mono">
        I takes no responsibility for the opinions expressed in this chat room;
        we are unable to check any facts and therefore cannot attest to the
        accuracy of information contained in any discussion thread.We urge you
        not to use language that may be offensive to others, promote violence or
        negative issues, advertise products or services, or infringe anyone
        else’s intellectual property or to give out personal information.
        reserves the right, but not the obligation, to monitor the content of
        this chat room and to remove, refuse to post or edit any material or
        content which we, in our sole discretion, determine to be objectionable.
        All users under 18 should participate in this chat room under the
        supervision of their parents. If you DO NOT AGREE with this disclaimer,
        please EXIT the site immediately.
      </div>
      <input
        className="input input-bordered input-success w-full max-w-xs"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter room code"
      />
      <button
        className="btn btn-secondary"
        onClick={handleJoinRoom}
        type="button"
      >
        Join
      </button>
    </div>
  );
}
