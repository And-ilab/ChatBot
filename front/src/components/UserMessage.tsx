import { UserMessageProps } from "../interfaces/interfaces";

const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  return (
    <div className="w-full flex justify-end">
      <div className="mt-[20px] px-[15px] py-[10px] bg-custom-gray rounded-2xl max-w-[526px] max-h-[600px] overflow-y-hidden break-words">
        {content}
      </div>
    </div>
  );
};

export default UserMessage;