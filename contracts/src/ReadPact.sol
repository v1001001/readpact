// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Testnet reading commitments. No owner, upgrade, or score-editing authority.
/// Reading is witnessed by members, not proven by the blockchain.
contract ReadPact is ReentrancyGuard {
    bytes32 public constant BOOK_ID = keccak256("naval-almanack-v1");
    uint256 public constant DEPOSIT = 10 ether;
    uint8 public constant MAX_MEMBERS = 10;
    uint256 public challengeCount;
    mapping(bytes32 => uint256) public bookFunds;

    struct Challenge {
        bytes32 bookId;
        address creator;
        uint64 joinUntil;
        uint64 startedAt;
        uint32 periodSeconds;
        uint32 graceSeconds;
        uint8 totalDays;
        uint8 requiredDays;
        bool demo;
        bool settled;
        bool cancelled;
        uint256 reservedFund;
        uint256 pool;
    }
    struct Member { bool joined; uint8 completed; uint256 claimable; }
    struct Entry { bytes32 contentHash; uint8 confirmations; bool completed; }
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => address[]) private participants;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => mapping(address => mapping(uint8 => Entry))) public entries;
    mapping(uint256 => mapping(address => mapping(uint8 => mapping(address => bool)))) public witnessed;

    event ChallengeCreated(uint256 indexed id, address indexed creator, bool demo);
    event Joined(uint256 indexed id, address indexed participant, uint256 amount);
    event Started(uint256 indexed id, uint256 startedAt, uint256 reservedFund);
    event Submitted(uint256 indexed id, address indexed participant, uint8 day, bytes32 contentHash);
    event Attested(uint256 indexed id, address indexed participant, uint8 day, address witness);
    event CheckedIn(uint256 indexed id, address indexed participant, uint8 day);
    event Settled(uint256 indexed id, uint256 winners, uint256 returnedToFund);
    event Cancelled(uint256 indexed id);
    event Claimed(uint256 indexed id, address indexed participant, uint256 amount);

    error InvalidState();
    error InvalidInput();
    error NotMember();
    error AlreadyDone();
    error OutsideWindow();
    error TransferFailed();

    /// @dev Only two fixed rule sets: 21/18 daily or a visibly labelled 3/2 short demo.
    function createChallenge(bool demo, uint64 joinUntil) external returns (uint256 id) {
        if (joinUntil <= block.timestamp || joinUntil > block.timestamp + 7 days) revert InvalidInput();
        id = ++challengeCount;
        challenges[id] = Challenge({bookId: BOOK_ID, creator: msg.sender, joinUntil: joinUntil,
            startedAt: 0, periodSeconds: demo ? 120 : 86400, graceSeconds: demo ? 60 : 3600,
            totalDays: demo ? 3 : 21, requiredDays: demo ? 2 : 18,
            demo: demo, settled: false, cancelled: false, reservedFund: 0, pool: 0});
        emit ChallengeCreated(id, msg.sender, demo);
    }

    function join(uint256 id) external payable {
        Challenge storage c = challenges[id];
        if (c.creator == address(0) || c.startedAt != 0 || c.settled) revert InvalidState();
        if (block.timestamp >= c.joinUntil) revert OutsideWindow();
        if (members[id][msg.sender].joined) revert AlreadyDone();
        if (msg.value != DEPOSIT || participants[id].length >= MAX_MEMBERS) revert InvalidInput();
        members[id][msg.sender].joined = true;
        participants[id].push(msg.sender);
        c.pool += msg.value;
        emit Joined(id, msg.sender, msg.value);
    }

    /// @notice Any paid member can start before the advertised deadline once 3 have joined.
    /// First group to actually start reserves the currently available same-book fund.
    function start(uint256 id) external {
        Challenge storage c = challenges[id];
        if (!members[id][msg.sender].joined) revert NotMember();
        if (c.startedAt != 0 || c.settled || participants[id].length < 3) revert InvalidState();
        if (block.timestamp >= c.joinUntil) revert OutsideWindow();
        c.startedAt = uint64(block.timestamp);
        c.reservedFund = bookFunds[c.bookId];
        bookFunds[c.bookId] = 0;
        emit Started(id, block.timestamp, c.reservedFund);
    }

    /// @notice If nobody starts before the deadline, anyone can unlock refunds.
    function cancelExpired(uint256 id) external {
        Challenge storage c = challenges[id];
        if (c.creator == address(0) || c.startedAt != 0 || c.settled) revert InvalidState();
        if (block.timestamp < c.joinUntil) revert OutsideWindow();
        c.settled = true;
        c.cancelled = true;
        for (uint256 i; i < participants[id].length; ++i) members[id][participants[id][i]].claimable = DEPOSIT;
        emit Cancelled(id);
    }

    function submit(uint256 id, uint8 day, bytes32 contentHash) external {
        Challenge storage c = challenges[id];
        if (!members[id][msg.sender].joined) revert NotMember();
        if (c.startedAt == 0 || c.settled || day >= c.totalDays) revert InvalidState();
        uint256 beginning = uint256(c.startedAt) + uint256(day) * c.periodSeconds;
        if (block.timestamp < beginning || block.timestamp >= beginning + c.periodSeconds) revert OutsideWindow();
        if (contentHash == bytes32(0)) revert InvalidInput();
        Entry storage entry = entries[id][msg.sender][day];
        if (entry.contentHash != bytes32(0)) revert AlreadyDone();
        entry.contentHash = contentHash;
        emit Submitted(id, msg.sender, day, contentHash);
    }

    /// @dev The second distinct member's transaction completes the check-in atomically.
    /// Grace is for witnessing an existing submission, never for late submissions.
    function attest(uint256 id, address participant, uint8 day, bytes32 contentHash) external {
        Challenge storage c = challenges[id];
        if (!members[id][msg.sender].joined || !members[id][participant].joined) revert NotMember();
        if (participant == msg.sender || day >= c.totalDays) revert InvalidInput();
        if (c.startedAt == 0 || c.settled) revert InvalidState();
        uint256 beginning = uint256(c.startedAt) + uint256(day) * c.periodSeconds;
        if (block.timestamp < beginning || block.timestamp >= beginning + c.periodSeconds + c.graceSeconds) revert OutsideWindow();
        Entry storage entry = entries[id][participant][day];
        if (contentHash == bytes32(0) || entry.contentHash != contentHash) revert InvalidInput();
        if (entry.completed || witnessed[id][participant][day][msg.sender]) revert AlreadyDone();
        witnessed[id][participant][day][msg.sender] = true;
        entry.confirmations++;
        emit Attested(id, participant, day, msg.sender);
        if (entry.confirmations == 2) {
            entry.completed = true;
            members[id][participant].completed++;
            emit CheckedIn(id, participant, day);
        }
    }

    function settle(uint256 id) external {
        Challenge storage c = challenges[id];
        if (c.startedAt == 0 || c.settled) revert InvalidState();
        if (block.timestamp < uint256(c.startedAt) + uint256(c.totalDays) * c.periodSeconds + c.graceSeconds) revert OutsideWindow();
        c.settled = true;
        uint256 winners;
        address[] storage list = participants[id];
        for (uint256 i; i < list.length; ++i) if (members[id][list[i]].completed >= c.requiredDays) ++winners;
        uint256 returned;
        if (winners == 0) {
            returned = c.pool + c.reservedFund;
        } else {
            uint256 distributable = c.pool;
            if (winners == list.length) distributable += c.reservedFund;
            else returned = c.reservedFund;
            uint256 each = distributable / winners;
            returned += distributable % winners;
            for (uint256 i; i < list.length; ++i) {
                if (members[id][list[i]].completed >= c.requiredDays) members[id][list[i]].claimable = each;
            }
        }
        bookFunds[c.bookId] += returned;
        emit Settled(id, winners, returned);
    }

    function claim(uint256 id) external nonReentrant {
        if (!challenges[id].settled) revert InvalidState();
        Member storage m = members[id][msg.sender];
        uint256 amount = m.claimable;
        if (amount == 0) revert InvalidInput();
        m.claimable = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Claimed(id, msg.sender, amount);
    }

    function getParticipants(uint256 id) external view returns (address[] memory) { return participants[id]; }
}
