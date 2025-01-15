// import { useState, useEffect, useRef } from 'react';
// import { MessageSquare, Send } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Textarea } from '@/components/ui/textarea';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// import { cn } from '@/lib/utils';

// interface Message {
//   id: string;
//   content: string;
//   sender: string;
//   timestamp: string;
//   isFromUser: boolean;
// }

// interface ChatInterfaceProps {
//   isOpen: boolean;
//   onClose: () => void;
//   recipientName: string;
// }

// export function ChatInterface({ isOpen, onClose, recipientName }: ChatInterfaceProps) {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [newMessage, setNewMessage] = useState('');
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   const handleSendMessage = () => {
//     if (!newMessage.trim()) return;

//     const message: Message = {
//       id: Date.now().toString(),
//       content: newMessage,
//       sender: 'You',
//       timestamp: new Date().toLocaleTimeString([], {
//         hour: '2-digit',
//         minute: '2-digit',
//       }),
//       isFromUser: true,
//     };

//     setMessages((prev) => [...prev, message]);
//     setNewMessage('');
//   };

//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSendMessage();
//     }
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="sm:max-w-[500px]">
//         <DialogHeader>
//           <DialogTitle>Chat with {recipientName}</DialogTitle>
//         </DialogHeader>

//         <div className="flex flex-col h-[500px]">
//           <div className="flex-1 overflow-y-auto p-4 space-y-4">
//             {messages.map((message) => (
//               <div
//                 key={message.id}
//                 className={cn(
//                   'flex flex-col max-w-[80%] space-y-1',
//                   message.isFromUser ? 'ml-auto items-end' : 'items-start',
//                 )}
//               >
//                 <div
//                   className={cn(
//                     'rounded-lg px-4 py-2',
//                     message.isFromUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
//                   )}
//                 >
//                   {message.content}
//                 </div>
//                 <span className="text-xs text-muted-foreground">{message.timestamp}</span>
//               </div>
//             ))}
//             <div ref={messagesEndRef} />
//           </div>

//           <div className="border-t p-4">
//             <div className="flex gap-2">
//               <Textarea
//                 value={newMessage}
//                 onChange={(e) => setNewMessage(e.target.value)}
//                 onKeyDown={handleKeyPress}
//                 placeholder="Type your message..."
//                 className="min-h-[80px]"
//               />
//               <Button onClick={handleSendMessage} className="px-3">
//                 <Send className="h-5 w-5" />
//               </Button>
//             </div>
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  isFromUser: boolean;
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
}

export function ChatInterface({ isOpen, onClose, recipientName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender: 'You',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isFromUser: true,
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chat with {recipientName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[500px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex flex-col max-w-[80%] space-y-1',
                  message.isFromUser ? 'ml-auto items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'rounded-lg px-4 py-2',
                    message.isFromUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {message.content}
                </div>
                <span className="text-xs text-muted-foreground">{message.timestamp}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="min-h-[80px]"
              />
              <Button onClick={handleSendMessage} className="px-3">
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
