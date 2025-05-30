document.addEventListener('DOMContentLoaded', () => {
    const t = key => window.COMMENTMARGIN_LANG?.[key] || key;
    const commentBoxes = [];

    // Ensure the sidebar container exists
    if (!document.getElementById("commentmargin-sidebar")) {
        const sidebar = document.createElement("div");
        sidebar.id = "commentmargin-sidebar";
        document.body.appendChild(sidebar);
    }

    function injectSpansInRange(range, anchorId) {
        const contents = range.cloneContents();
        const walker = document.createTreeWalker(contents, NodeFilter.SHOW_TEXT);
        const spans = [];

        while (walker.nextNode()) {
            const originalText = walker.currentNode.nodeValue;
            if (originalText.trim()) {
                const span = document.createElement("span");
                span.className = "comment-highlight";
                span.id = spans.length === 0 ? anchorId : `${anchorId}_${spans.length}`;
                span.textContent = originalText;

                walker.currentNode.parentNode.replaceChild(span, walker.currentNode);
                spans.push(span);
            }
        }

        // Insert each child node of the cloned content back in reverse order
        range.deleteContents();
        const fragmentChildren = Array.from(contents.childNodes);
        for (let i = fragmentChildren.length - 1; i >= 0; i--) {
            range.insertNode(fragmentChildren[i]);
        }

        return spans;
    }

    function findMatchingNodesFromHTML(fragment, root) {
        const fragText = fragment.textContent.trim().replace(/\s+/g, ' ');
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        while (walker.nextNode()) {
            const candidate = walker.currentNode.cloneNode(true);
            const text = candidate.textContent.trim().replace(/\s+/g, ' ');
            if (text === fragText) {
                return {
                    startNode: walker.currentNode,
                    endNode: walker.currentNode
                };
            }
        }

        return null;
    }


    const injectHighlight = (anchorId, selectedText, before, after, selectedHTML = null) => {
        console.log("Injecting:", { anchorId, selectedText, before, after, selectedHTML });

        const beforeSafe = before || '';
        const afterSafe = after || '';

        // --- STEP 0: remove the embedded JSON once used
        const scriptTag = document.getElementById('commentmargin-data');
        if (scriptTag) {
            try {
                scriptTag.remove();
            } catch (err) {
                console.warn("injectHighlight: couldn't remove script tag", err);
            }
        }

        // --- STEP 1: Try selectedHTML-based injection ---
        if (selectedHTML) {
            const html = document.body.innerHTML;

            const encodedHTML = selectedHTML
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const index = html.indexOf(selectedHTML);
            const indexEncoded = html.indexOf(encodedHTML);

            const htmlToFind = index !== -1 ? selectedHTML : (indexEncoded !== -1 ? encodedHTML : null);
            const foundAt = index !== -1 ? index : (indexEncoded !== -1 ? indexEncoded : -1);

            if (foundAt !== -1) {
                // Create a DOM parser container from selectedHTML
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = htmlToFind;
                const fragment = tempDiv.cloneNode(true);

                // Try to find the nodes in the actual document that match these HTML elements
                const match = findMatchingNodesFromHTML(fragment, document.body);
                if (!match) {
                    console.warn("injectHighlight: failed to map selectedHTML to live DOM nodes");
                    return null;
                }

                const { startNode, endNode } = match;
                if (!startNode || !endNode) {
                    console.warn("injectHighlight: could not find full range for selectedHTML");
                    return null;
                }

                // Create a range and use injectSpansInRange
                const range = document.createRange();
                range.setStartBefore(startNode);
                range.setEndAfter(endNode);

                const spans = injectSpansInRange(range, anchorId);
                return spans[0] || null;
            }

            // Fallback: use DOM fuzzy search on textContent
            const temp = document.createElement("div");
            temp.innerHTML = selectedHTML;
            const textToFind = temp.textContent.trim();

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let fullText = '';
            const nodes = [];

            while (walker.nextNode()) {
                const node = walker.currentNode;
                const parentTag = node.parentNode?.nodeName?.toUpperCase();
                if (parentTag === "SCRIPT" || parentTag === "STYLE") continue;

                nodes.push({ node, start: fullText.length });
                fullText += node.nodeValue;
            }

            const idx = fullText.indexOf(textToFind);
            if (idx !== -1) {
                let startNode = null, endNode = null;
                let startOffset = 0, endOffset = 0;
                let remainingStart = idx;
                let remainingEnd = idx + textToFind.length;

                for (const { node } of nodes) {
                    const len = node.nodeValue.length;
                    if (!startNode && remainingStart < len) {
                        startNode = node;
                        startOffset = remainingStart;
                    }
                    remainingStart -= len;

                    if (!endNode && remainingEnd <= len) {
                        endNode = node;
                        endOffset = remainingEnd;
                        break;
                    }
                    remainingEnd -= len;
                }

                if (startNode && endNode) {
                    const range = document.createRange();
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);

                    const spans = injectSpansInRange(range, anchorId);
                    return spans[0] || null;
                }
            }

            console.warn("injectHighlight: selectedHTML not found using HTML or fallback text match");
        }

        // --- STEP 2: Text-based match ---
        const root = document.body;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let fullText = '';

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            if (parentTag === "SCRIPT" || parentTag === "STYLE") continue;

            textNodes.push({ node, start: fullText.length });
            fullText += node.nodeValue;
        }

        let index = fullText.indexOf(selectedText);
        if (index === -1) {
            console.warn("injectHighlight: selectedText not found in flattened content");
            return null;
        }

        const actualBefore = fullText.slice(Math.max(0, index - beforeSafe.length), index);
        const actualAfter = fullText.slice(index + selectedText.length, index + selectedText.length + afterSafe.length);

        const relaxedMatchBefore = !beforeSafe || actualBefore.trim().includes(beforeSafe.trim());
        const relaxedMatchAfter = !afterSafe || actualAfter.trim().includes(afterSafe.trim());

        console.log("Match context:", {
            index,
            actualBefore,
            actualAfter,
            expectedBefore: beforeSafe,
            expectedAfter: afterSafe,
            relaxedMatchBefore,
            relaxedMatchAfter
        });

        if (!relaxedMatchBefore || !relaxedMatchAfter) {
            console.warn("injectHighlight: relaxed context mismatch, attempting fallback");

            const allOccurrences = [];
            let pos = 0;
            while (pos < fullText.length) {
                const i = fullText.indexOf(selectedText, pos);
                if (i === -1) break;
                allOccurrences.push(i);
                pos = i + selectedText.length;
            }

            if (allOccurrences.length === 1) {
                console.info("injectHighlight: using fallback injection due to unique match");
                index = allOccurrences[0];
            } else {
                console.warn("injectHighlight: ambiguous fallback match — multiple matches");
                return null;
            }
        }

        // --- STEP 3: Map offsets back to nodes ---
        let startNode = null, endNode = null;
        let startOffset = 0, endOffset = 0;
        let remainingStart = index;
        let remainingEnd = index + selectedText.length;

        for (const { node } of textNodes) {
            const len = node.nodeValue.length;

            if (!startNode && remainingStart < len) {
                startNode = node;
                startOffset = remainingStart;
            }
            remainingStart -= len;

            if (!endNode && remainingEnd <= len) {
                endNode = node;
                endOffset = remainingEnd;
                break;
            }
            remainingEnd -= len;
        }

        console.log("Highlight range:", {
            startNode: startNode?.nodeValue?.slice(0, 30) + "...",
            startOffset,
            endNode: endNode?.nodeValue?.slice(0, 30) + "...",
            endOffset
        });

        if (!startNode || !endNode) {
            console.warn("injectHighlight: failed to map DOM nodes");
            return null;
        }

        const range = document.createRange();
        try {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
        } catch (err) {
            console.error("injectHighlight: error creating range", err);
            return null;
        }

        const span = document.createElement("span");
        span.id = anchorId;
        span.className = "comment-highlight";
        span.textContent = selectedText;

        range.deleteContents();
        range.insertNode(span);
        return span;
    };








    function alignCommentBoxToHighlight(anchorID, commentBox) {
        const highlight = document.getElementById(anchorID);
        if (!highlight) return;

        const rect = highlight.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let top = rect.top + scrollTop;

        // Avoid overlaps
        let overlapOffset = 0;
        for (const { element } of commentBoxes) {
            if (element === commentBox) continue;

            const otherTop = parseFloat(element.style.top || '0');
            const otherHeight = element.offsetHeight || 0;

            if (top + overlapOffset < otherTop + otherHeight &&
                top + overlapOffset + commentBox.offsetHeight > otherTop) {
                overlapOffset = otherTop + otherHeight - top + 8;
            }
        }

        commentBox.style.top = `${top + overlapOffset}px`;
    }

    const addToSidebar = (anchorId, text, comment) => {
        const div = document.createElement("div");
        div.className = "comment-box";
        div.innerHTML = `<a href="#${anchorId}">${text}</a><p>${comment}</p>`;
        document.body.appendChild(div);
        commentBoxes.push({ anchorId, element: div });

        void div.offsetHeight;

        commentBoxes.sort((a, b) => {
            const elA = document.getElementById(a.anchorId);
            const elB = document.getElementById(b.anchorId);
            if (!elA || !elB) return 0;

            const pos = elA.compareDocumentPosition(elB);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });

        commentBoxes.forEach(({ element }) => {
            document.body.appendChild(element); // move in DOM to match sort order
            element.style.top = ''; // reset position to avoid stale overlap
        });

        commentBoxes.forEach(({ anchorId, element }) => {
            alignCommentBoxToHighlight(anchorId, element);
        });

     };

    window.addEventListener('scroll', () => {
        commentBoxes.forEach(({ anchorId, element }) => alignCommentBoxToHighlight(anchorId, element));
    });

    window.addEventListener('resize', () => {
        commentBoxes.forEach(({ anchorId, element }) => alignCommentBoxToHighlight(anchorId, element));
    });

    const postComment = async (pageId, selected, before, after, comment, selectedHTML) => {
        // Try to inject temporarily to validate selection
        const testSpan = injectHighlight("__preview__", selected, before, after, selectedHTML);
        if (!testSpan) {
            alert(t("js_selection_not_found"));
            return; // Abort submission
        }
        testSpan.remove(); // Clean up the temporary preview

        const params = new URLSearchParams({
            id: pageId,
            selected,
            before,
            after,
            comment,
            selected_html: selectedHTML
        });

        try {
            const response = await fetch(DOKU_BASE + "lib/plugins/commentmargin/ajax.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            if (result.success) {
                location.reload(); // reload to reflect the newly saved comment
            } else {
                alert(t("js_error") + ": " + (result.error || t("js_unknown_error")));
            }
        } catch (err) {
            alert(t("js_error") + ": " + err.message);
        }
    };

    // Load pre-existing comments if available
    function loadCommentData() {
        const raw = document.getElementById('commentmargin-data')?.textContent;
        if (!raw) {
            console.warn("No comment data found");
            return [];
        }

        try {
            return JSON.parse(raw);
        } catch (err) {
            console.error("Failed to parse comment data:", err);
            return [];
        }
    }

    const COMMENTMARGIN_DATA = loadCommentData();

    if (Array.isArray(COMMENTMARGIN_DATA)) {
        COMMENTMARGIN_DATA.forEach(comment => {
            const span = injectHighlight(comment.anchor_id, comment.selected, comment.before || null, comment.after || null, comment.selected_html || null);
            if (span) {
                addToSidebar(comment.anchor_id, comment.selected, comment.text);
            }
        });
    }

    // Immediately clean up to prevent polluting textContent
    //const scriptTags = document.querySelectorAll('script');
    //scriptTags.forEach(script => {
    //    if (script.textContent.includes('window.COMMENTMARGIN_DATA')) {
    //        script.remove();
    //    }
    //});

    const btn = document.getElementById('commentmargin-add-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (!selectedText) {
            alert(t("js_select_text"));
            return;
        }

        // Capture HTML instead of just text
        const getSelectedHTML = () => {
            if (selection.rangeCount === 0) return '';
            const range = selection.getRangeAt(0);
            const container = document.createElement("div");
            container.appendChild(range.cloneContents());
            return container.innerHTML;
        };

        const selectedHTML = getSelectedHTML().trim();
        if (!selectedHTML) {
            alert("Could not capture HTML selection.");
            return;
        }

        let before = "";
        let after = "";

        try {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.nodeType === 1
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentNode;

            const fullText = container.textContent;
            const index = fullText.indexOf(selectedText);

            if (index !== -1) {
                const contextSize = 20;
                before = fullText.slice(Math.max(0, index - contextSize), index);
                after = fullText.slice(index + selectedText.length, index + selectedText.length + contextSize);
            } else {
                console.warn("Text-based context could not be computed, relying on selectedHTML only.");
            }
        } catch (err) {
            console.warn("Error while computing before/after:", err);
        }

        const comment = prompt(t("js_enter_comment") + "\n" + selectedText);
        if (!comment) return;

        const pageId = window.DOKU_ID;
        postComment(pageId, selectedText, before, after, comment, selectedHTML);
    });


});
