export type PathInstanceType = "file" | "folder";
export type PathInstance = {
    name: string;
    path: string;
    type: PathInstanceType;
};

export type PathInstancesResponse = {
    items: PathInstance[];
};

export type MessageResponse = {
    message: string;
};
