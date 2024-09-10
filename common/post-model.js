/* eslint-disable import/no-unresolved */
import SimpleSchema from 'meteor/aldeed:simple-schema';
/* eslint-enable import/no-unresolved */

export default ({ Meteor, Mongo, LikeableModel, CommentableModel, LinkableModel, LinkParent, ServerTime }) => {
    const PostsCollection = new Mongo.Collection('socialize:posts');

    if (PostsCollection.configureRedisOplog) {
        PostsCollection.configureRedisOplog({
            mutation(options, { selector, doc }) {
                const namespaces = [PostsCollection._name];
                let linkedObjectId = (selector && selector.linkedObjectId) || (doc && doc.linkedObjectId);

                if (!linkedObjectId && selector._id) {
                    const comment = PostsCollection.findOne({ _id: selector._id }, { fields: { linkedObjectId: 1 } });
                    linkedObjectId = comment && comment.linkedObjectId;
                }

                if (linkedObjectId) {
                    namespaces.push(linkedObjectId);
                }
                Object.assign(options, {
                    namespaces,
                });
            },
            cursor(options, selector) {
                let namespaces = [PostsCollection._name];
                const { linkedObjectId } = selector;
                if (linkedObjectId) {
                    if (linkedObjectId.$in) {
                        namespaces = linkedObjectId.$in;
                    } else {
                        namespaces = [linkedObjectId];
                    }
                }
                Object.assign(options, {
                    namespaces,
                });
            },
        });
    }

    // create the schema for a post
    const PostsSchema = new SimpleSchema({
        // The _id of the user who creates the post.
        posterId: {
            type: String,
            autoValue() {
                if (this.isInsert) {
                    return this.userId;
                }
                return undefined;
            },
            index: 1,
            denyUpdate: true,
        },
        createdAt: {
            type: Date,
            autoValue() {
                if (this.isInsert) {
                    return ServerTime.date();
                }
                return undefined;
            },
            index: -1,
            denyUpdate: true,
        },
        updatedAt: {
            type: Date,
            optional: true,
            autoValue() {
                return ServerTime.date();
            },
        },
        // The body text of the post
        body: {
            type: SimpleSchema.oneOf(String, Object),
        },
    });

    // Attach the schema
    PostsCollection.attachSchema(PostsSchema);

    /**
    *  A post model
    *  @class Post
    *  @extends LikeableModel
    *  @extends CommentableModel
    *  @extends LinkabelModel
    *  @extends BaseModel
    */
    class Post extends LikeableModel(CommentableModel(LinkableModel(LinkParent))) {
        /**
        * The user who created the post
        * @returns {User} The user who sent the post
        */
        poster() {
            const posterId = this.posterId;
            return Meteor.users.findOne({ _id: posterId });
        }

        /**
        * Check to see if the current user was either the user posted to or the posting user
        * @returns {Boolean} Whether the user is considered an "owner" of the post
        */
        canRemove() {
            const currentUserId = Meteor.userId();
            return this.posterId === currentUserId ||
            this.linkedObjectId === currentUserId ||
            this.linkedParent().userId === currentUserId;
        }

        /**
        * Check if the current user is allowed to update the post
        * @returns {Boolean} Whether or not the user is allowed to update the post
        */
        canUpdate() {
            const currentUserId = Meteor.userId();
            return this.posterId === currentUserId;
        }
    }

    // Attach the collection to the Post Class
    Post.attachCollection(PostsCollection);

    // attach likeable schema since we extend LikeableModel
    Post.appendSchema(LikeableModel.LikeableSchema);
    // attach commentable schema since we extend CommentableModel
    Post.appendSchema(CommentableModel.CommentableSchema);
    // attach linkable schema since posts will now be linked to models that extend PostableModel
    Post.appendSchema(LinkableModel.LinkableSchema);
    // register the post model as a linkable type
    LinkableModel.registerParentModel(Post);

    return { Post, PostsCollection };
};
