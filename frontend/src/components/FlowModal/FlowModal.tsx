import { AnsiRenderer } from "@waldiez/studio/components/AnsiRenderer";
import "@waldiez/studio/components/FlowModal/FlowModal.css";

import React, { useEffect, useRef, useState } from "react";
import { FaCircleXmark } from "react-icons/fa6";
import { FiSend } from "react-icons/fi";

type FlowModalProps = {
    isOpen: boolean;
    title: string;
    messages: string[];
    prompt: string | null;
    onClose: () => void;
    onSubmit: (input: string) => void;
};

export const FlowModal: React.FC<FlowModalProps> = ({
    isOpen,
    title,
    messages,
    prompt,
    onClose,
    onSubmit,
}) => {
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt) {
            onSubmit(inputValue);
            setInputValue("");
        }
    };

    const handleKetDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSubmit(e);
        }
    };
    const handleCloseModal = () => {
        onClose();
    };
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);
    if (!isOpen || messages.length === 0) {
        return null;
    }

    return (
        <div className="waldiez-studio-flow-modal">
            <div className="waldiez-studio-flow-modal-content">
                <div className="waldiez-studio-flow-modal-header">
                    <h2>{title}</h2>
                    <div
                        className="modal-close-btn clickable"
                        role="button"
                        title="Close"
                        data-testid="modal-close-btn"
                        onClick={handleCloseModal}
                    >
                        <FaCircleXmark />
                    </div>
                </div>
                <div className="waldiez-studio-flow-messages-container">
                    <ul>
                        {messages.map((message, index) => (
                            <li key={index}>
                                <AnsiRenderer text={message} />
                            </li>
                        ))}
                    </ul>
                    <div ref={messagesEndRef} />
                </div>
                {prompt && <div className="waldiez-studio-flow-prompt-view">{prompt}</div>}
                <div className="waldiez-studio-flow-input-container">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        disabled={!prompt}
                        onKeyDown={handleKetDown}
                        placeholder="Enter your message"
                    />
                    <button type="submit" onClick={handleSubmit} aria-label="Send" disabled={!prompt}>
                        <FiSend size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};
