/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import MediaViewer from "@/features/viewers/components/MediaViewer";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MediaViewer", () => {
    describe("image rendering", () => {
        it("renders image for image MIME types", () => {
            render(<MediaViewer url="http://example.com/image.png" mime="image/png" />);

            const img = screen.getByRole("img");
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute("src", "http://example.com/image.png");
            expect(img).toHaveAttribute("alt", "media");
        });

        it("applies correct CSS classes to image wrapper", () => {
            const { container } = render(
                <MediaViewer url="http://example.com/image.jpg" mime="image/jpeg" />,
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass(
                "h-full",
                "w-full",
                "overflow-auto",
                "p-2",
                "grid",
                "place-items-center",
            );
        });

        it("applies correct CSS classes to image element", () => {
            render(<MediaViewer url="http://example.com/image.png" mime="image/png" />);

            const img = screen.getByRole("img");
            expect(img).toHaveClass(
                "max-w-full",
                "max-h-full",
                "object-contain",
                "rounded",
                "border",
                "border-[var(--border-color)]",
            );
        });

        it("handles different image formats", () => {
            const formats = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

            formats.forEach(mime => {
                const { unmount } = render(
                    <MediaViewer url={`http://example.com/image.${mime.split("/")[1]}`} mime={mime} />,
                );

                expect(screen.getByRole("img")).toBeInTheDocument();
                unmount();
            });
        });
    });

    // describe("video rendering", () => {
    //     it("renders video for video MIME types", () => {
    //         render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" />);

    //         const video = screen.getByRole("video");
    //         expect(video).toBeInTheDocument();
    //         expect(video).toHaveAttribute("src", "http://example.com/video.mp4");
    //     });

    //     it("enables controls by default", () => {
    //         render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" />);

    //         const video = screen.getByRole("video");
    //         expect(video).toHaveAttribute("controls");
    //     });

    //     it("respects controls prop", () => {
    //         render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" controls={false} />);

    //         const video = screen.getByRole("video");
    //         expect(video).not.toHaveAttribute("controls");
    //     });

    //     it("handles autoPlay prop", () => {
    //         render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" autoPlay={true} />);

    //         const video = screen.getByRole("video");
    //         expect(video).toHaveAttribute("autoplay");
    //     });

    //     it("handles loop prop", () => {
    //         render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" loop={true} />);

    //         const video = screen.getByRole("video");
    //         expect(video).toHaveAttribute("loop");
    //     });

    //     it("applies correct CSS classes to video", () => {
    //         render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" />);

    //         const video = screen.getByRole("video");
    //         expect(video).toHaveClass(
    //             "h-full",
    //             "w-full",
    //             "rounded",
    //             "border",
    //             "border-[var(--border-color)]",
    //         );
    //     });
    // });

    // describe("audio rendering", () => {
    //     it("renders audio for audio MIME types", () => {
    //         render(<MediaViewer url="http://example.com/audio.mp3" mime="audio/mpeg" />);

    //         const audio = screen.getByRole("audio");
    //         expect(audio).toBeInTheDocument();
    //         expect(audio).toHaveAttribute("src", "http://example.com/audio.mp3");
    //         expect(audio).toHaveAttribute("controls");
    //     });

    //     it("applies correct CSS classes to audio", () => {
    //         render(<MediaViewer url="http://example.com/audio.mp3" mime="audio/mpeg" />);

    //         const audio = screen.getByRole("audio");
    //         expect(audio).toHaveClass("w-full");
    //     });

    //     it("applies default className to audio wrapper", () => {
    //         const { container } = render(
    //             <MediaViewer url="http://example.com/audio.mp3" mime="audio/mpeg" />,
    //         );

    //         const wrapper = container.firstChild as HTMLElement;
    //         expect(wrapper).toHaveClass("p-4");
    //     });
    // });

    describe("unsupported media types", () => {
        it("renders fallback for unsupported MIME types", () => {
            render(<MediaViewer url="http://example.com/file.pdf" mime="application/pdf" />);

            expect(screen.getByText("Unsupported media type: application/pdf.")).toBeInTheDocument();

            const downloadLink = screen.getByText("Download");
            expect(downloadLink).toBeInTheDocument();
            expect(downloadLink.closest("a")).toHaveAttribute("href", "http://example.com/file.pdf");
            expect(downloadLink.closest("a")).toHaveAttribute("download");
        });

        it("applies default className to fallback", () => {
            const { container } = render(
                <MediaViewer url="http://example.com/file.pdf" mime="application/pdf" />,
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("p-4", "text-sm", "opacity-70");
        });
    });

    describe("custom className", () => {
        it("applies custom className to image wrapper", () => {
            const { container } = render(
                <MediaViewer
                    url="http://example.com/image.png"
                    mime="image/png"
                    className="custom-image-class"
                />,
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("custom-image-class");
        });

        it("applies custom className to video wrapper", () => {
            const { container } = render(
                <MediaViewer
                    url="http://example.com/video.mp4"
                    mime="video/mp4"
                    className="custom-video-class"
                />,
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("custom-video-class");
        });

        it("applies custom className to audio wrapper", () => {
            const { container } = render(
                <MediaViewer
                    url="http://example.com/audio.mp3"
                    mime="audio/mpeg"
                    className="custom-audio-class"
                />,
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("custom-audio-class");
        });

        it("applies custom className to fallback wrapper", () => {
            const { container } = render(
                <MediaViewer
                    url="http://example.com/file.pdf"
                    mime="application/pdf"
                    className="custom-fallback-class"
                />,
            );

            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass("custom-fallback-class");
        });
    });

    describe("edge cases", () => {
        // it("handles empty URL", () => {
        //     render(<MediaViewer url="" mime="image/png" />);

        //     const img = screen.getByRole("img");
        //     expect(img).toHaveAttribute("src", "");
        // });

        it("handles malformed URLs", () => {
            render(<MediaViewer url="not-a-url" mime="image/png" />);

            const img = screen.getByRole("img");
            expect(img).toHaveAttribute("src", "not-a-url");
        });

        it("handles edge case MIME types", () => {
            render(<MediaViewer url="http://example.com/file" mime="image/" />);

            // Should still render as image due to startsWith check
            expect(screen.getByRole("img")).toBeInTheDocument();
        });

        it("handles empty MIME type", () => {
            render(<MediaViewer url="http://example.com/file" mime="" />);

            // Should render fallback
            expect(screen.getByText("Unsupported media type: .")).toBeInTheDocument();
        });

        it("handles case-sensitive MIME types", () => {
            render(<MediaViewer url="http://example.com/image.png" mime="IMAGE/PNG" />);

            // Should render fallback since MIME check is case-sensitive
            expect(screen.getByText("Unsupported media type: IMAGE/PNG.")).toBeInTheDocument();
        });
    });

    describe("accessibility", () => {
        it("provides proper alt text for images", () => {
            render(<MediaViewer url="http://example.com/image.png" mime="image/png" />);

            const img = screen.getByRole("img");
            expect(img).toHaveAttribute("alt", "media");
        });

        // it("renders video with proper role", () => {
        //     render(<MediaViewer url="http://example.com/video.mp4" mime="video/mp4" />);

        //     expect(screen.getByRole("video")).toBeInTheDocument();
        // });

        // it("renders audio with proper role", () => {
        //     render(<MediaViewer url="http://example.com/audio.mp3" mime="audio/mpeg" />);

        //     expect(screen.getByRole("audio")).toBeInTheDocument();
        // });

        it("provides accessible download link", () => {
            render(<MediaViewer url="http://example.com/file.pdf" mime="application/pdf" />);

            const link = screen.getByRole("link", { name: "Download" });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute("href", "http://example.com/file.pdf");
        });
    });
});
