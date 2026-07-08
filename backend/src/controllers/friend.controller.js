import { friendService } from '../services/friend.service.js';
import { getOnlineUserIds } from '../socket/userMap.js';

export async function sendRequest(req, res, next) {
  try {
    const { toUserId, email } = req.body;
    const friendship = await friendService.createRequest(req.user.userId, { toUserId, email });
    res.status(201).json({ friendship });
  } catch (err) {
    next(err);
  }
}

export async function respondRequest(req, res, next) {
  try {
    const { requestId, action } = req.body;
    if (!requestId || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: "requestId and a valid action ('accept'|'decline') are required" });
    }
    const friendship = await friendService.respondToRequest(requestId, req.user.userId, action);
    res.json({ friendship });
  } catch (err) {
    next(err);
  }
}

export async function listFriends(req, res, next) {
  try {
    const friends = await friendService.listFriends(req.user.userId, getOnlineUserIds());
    res.json({ friends });
  } catch (err) {
    next(err);
  }
}

export async function listRequests(req, res, next) {
  try {
    const requests = await friendService.listRequests(req.user.userId);
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

export async function removeFriend(req, res, next) {
  try {
    await friendService.removeFriendship(req.user.userId, req.params.friendId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function searchUsers(req, res, next) {
  try {
    const { query } = req.body;
    const results = await friendService.searchProfiles(req.user.userId, query);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}
