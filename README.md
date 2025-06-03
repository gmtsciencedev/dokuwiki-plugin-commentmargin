# dokuwiki-plugin-commentmargin

commentmargin is (yet another) commenting plugin for Dokuwiki. It has several quality that makes it particularly adapted for regulatory usage (but that might get handy in other contexts):

- it does not change the page (we use it in combination with the publish plugin and adding a comment won't invalidate a published version of a page),
- it is quite reminiscent of comment in MS Word: you select the text, click on the new comment button that the plugin add on the right tool bar, and add your comment.

Technically, comments are stored in `.comments` pages in the dokuwiki/data/meta folder,

## Install

Copy the complete repo as `commentmargin` in your dokuwiki/lib/plugins/ folder, like this:

```sh
cd dokuwiki/lib/plugins
git clone https://github.com/gmtsciencedev/dokuwiki-plugin-commentmargin.git commentmargin
```

And restart dokuwiki.