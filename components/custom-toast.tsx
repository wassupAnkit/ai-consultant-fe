import React from "react";
import { Toaster } from "@/components/ui/sonner";

const CustomToast = () => {
  return (
    <Toaster
      position="top-center"
      richColors
      theme="light"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-white dark:bg-zinc-950 border border-gray-200 shadow-lg p-4",
          title: "text-base font-bold",
          description: "text-sm",
          actionButton: "bg-zinc-900",
          cancelButton: "bg-zinc-100",
        },
      }}
    />
  );
};

export default CustomToast;
