const { expect } = require("chai");
const { ethers } = require("hardhat");

const duration = 30; // 30 sec for tests

const mineBlocks = async (n) => {
  for (let index = 0; index < n; index++) {
    await ethers.provider.send('evm_mine');
  }
}

describe("Should deploy the Votings contract ", function () {
  it("Should create the contract", async function () {
    const Votings = await ethers.getContractFactory("Votings");
    votings = await Votings.deploy(duration);
    await votings.deployed();
  });
});

describe("Votings: create a new voting", function () {

  let votings;
  let owner;
  let admin;
  let participants = [];

  beforeEach(async () => {
    const Votings = await ethers.getContractFactory("Votings");
    votings = await Votings.deploy(duration);
    await votings.deployed();
    const ADMIN = ethers.utils.solidityKeccak256(["string"], ["VOTING_ADMIN_ROLE"]);
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    admin = accounts[1];
    participants = accounts.slice(2, 4);
    await votings.grantRole(ADMIN, admin.address);
  });

  it("c1: Should create the new voting", async function () {

    const TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    await votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);

    expect(await votings.getActiveUntil(TEST_VOTING)).to.not.equal(0);
  });

  it("c2: Should fail creation by not admin user", async function () {
    const TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    const startVotingAttempt = votings.connect(owner).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);

    await expect(startVotingAttempt).to.be.revertedWith("Caller is not an admin");

  });

  it("c3: Should try to create voting with one participant and fail", async function () {
    const TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    const startVotingAttempt = votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address]);

    await expect(startVotingAttempt).to.be.revertedWith("There must be at least two participants");

  });

  it("c4: Should try to create voting twice and fail", async function () {
    const TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    await votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);
    const startVotingAttempt = votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);

    await expect(startVotingAttempt).to.be.revertedWith("The voting already started");

  });
});

describe("Votings (2 participants): vote", function () {
  let votings;
  let owner;
  let admin;
  let participants = [];
  let voters = [];
  let TEST_VOTING;

  beforeEach(async () => {
    const Votings = await ethers.getContractFactory("Votings");
    votings = await Votings.deploy(duration);
    await votings.deployed();
    const ADMIN = ethers.utils.solidityKeccak256(["string"], ["VOTING_ADMIN_ROLE"]);
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    admin = accounts[1];
    participants = accounts.slice(2, 4);
    voters = accounts.slice(4);
    await votings.grantRole(ADMIN, admin.address);

    TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    await votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);
  });

  it("v1: Should vote", async function () {
    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });

    const getVotes = votings.getVotes(TEST_VOTING, participants[0].address);

    expect(await getVotes).to.be.equal(1);
  });

  it("v2: Should try to vote twice and fail", async function () {
    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });
    const secondVote = votings.connect(voters[0]).vote(TEST_VOTING, participants[1].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await expect(secondVote).to.be.revertedWith("You can vote only once");
  });

  it("v3: Should try to vote without paying and fail", async function () {
    const voteAttempt = votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address);
    await expect(voteAttempt).to.be.revertedWith("You have to send 0.01 ether for voting");
  });

  it("v4: Should try to vote with paying inappropriate amount and fail", async function () {
    const voteAttempt = votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.011")
    });
    await expect(voteAttempt).to.be.revertedWith("You have to send 0.01 ether for voting");
  });

  it("v5: Should try to vote after deadline and fail", async function () {
    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await mineBlocks(35);
    const voteAttempt = votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await expect(voteAttempt).to.be.revertedWith("There is no such active voting");
  });

  it("v6: Should try to vote nonexistent voting and fail", async function () {
    const FAKE_VOTING = ethers.utils.solidityKeccak256(["string"], ["FAKE VOTING"]);
    const voteAttempt = votings.connect(voters[0]).vote(FAKE_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await expect(voteAttempt).to.be.revertedWith("There is no such active voting");
  });

  it("v7: Should try to vote for not-participant and fail", async function () {
    const voteAttempt = votings.connect(voters[0]).vote(TEST_VOTING, voters[1].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await expect(voteAttempt).to.be.revertedWith("There is no such participant in the voting");
  });

});

describe("Votings (2 participants): finish", function () {
  let votings;
  let owner;
  let admin;
  let participants = [];
  let voters = [];
  let TEST_VOTING;

  beforeEach(async () => {
    const Votings = await ethers.getContractFactory("Votings");
    votings = await Votings.deploy(duration);
    await votings.deployed();
    const ADMIN = ethers.utils.solidityKeccak256(["string"], ["VOTING_ADMIN_ROLE"]);
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    admin = accounts[1];
    participants = accounts.slice(2, 4);
    voters = accounts.slice(4);
    await votings.grantRole(ADMIN, admin.address);

    TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    await votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);
  });

  it("f1: Should try to finish voting before the deadline and fail", async function () {

    const finishVotingAttempt = votings.connect(admin).finishVoting(TEST_VOTING);
    await expect(finishVotingAttempt).to.be.revertedWith("Voting is still active");

  });

  it("f2: Should finish voting without votes", async function () {
    const provider = ethers.provider;

    const balance1Before = await provider.getBalance(participants[0].address);
    const balance2Before = await provider.getBalance(participants[1].address);

    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);

    const balance1After = await provider.getBalance(participants[0].address);
    const balance2After = await provider.getBalance(participants[1].address);

    expect(balance1After.eq(balance1Before)).to.be.true;
    expect(balance2After.eq(balance2Before)).to.be.true;
  });

  it("f2a: Should vote and finish voting (1 winner)", async function () {
    const participant1 = participants[0];
    const participant2 = participants[1];
    const voter1 = voters[0];

    await votings.connect(voter1).vote(TEST_VOTING, participant1.address, {
      value: ethers.utils.parseEther("0.01")
    });

    const provider = ethers.provider;
    const balanceBefore = await provider.getBalance(participant1.address);
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const balanceAfter = await provider.getBalance(participant1.address);
    const feeAmount = await votings.getFeeAmount();

    expect(balanceAfter.sub(balanceBefore)).to.be.equal(ethers.utils.parseEther("0.009"));
    expect(feeAmount).to.be.equal(ethers.utils.parseEther("0.001"));
  });

  it("f2b: Should vote and finish voting (2 votes, 2 winner)", async function () {

    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await votings.connect(voters[1]).vote(TEST_VOTING, participants[1].address, {
      value: ethers.utils.parseEther("0.01")
    });

    const provider = ethers.provider;
    const balance1Before = await provider.getBalance(participants[0].address);
    const balance2Before = await provider.getBalance(participants[1].address);
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const balance1After = await provider.getBalance(participants[0].address);
    const balance2After = await provider.getBalance(participants[1].address);
    const feeAmount = await votings.getFeeAmount();

    expect(balance1After.sub(balance1Before)).to.be.equal(ethers.utils.parseEther("0.009"));
    expect(balance2After.sub(balance2Before)).to.be.equal(ethers.utils.parseEther("0.009"));
    expect(feeAmount).to.be.equal(ethers.utils.parseEther("0.002"));
  });

  it("f2b: Should vote and finish voting (3 votes, 2 winner)", async function () {

    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await votings.connect(voters[1]).vote(TEST_VOTING, participants[1].address, {
      value: ethers.utils.parseEther("0.01")
    });
    await votings.connect(voters[2]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });

    const provider = ethers.provider;
    const balance1Before = await provider.getBalance(participants[0].address);
    const balance2Before = await provider.getBalance(participants[1].address);
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const balance1After = await provider.getBalance(participants[0].address);
    const balance2After = await provider.getBalance(participants[1].address);
    const feeAmount = await votings.getFeeAmount();

    expect(balance1After.sub(balance1Before)).to.be.equal(ethers.utils.parseEther("0.027"));
    expect(balance2After.sub(balance2Before)).to.be.equal(ethers.utils.parseEther("0"));
    expect(feeAmount).to.be.equal(ethers.utils.parseEther("0.003"));
  });

  it("f3 Should try to finish nonexistent voting and fail", async function () {

    const FAKE_VOTING = ethers.utils.solidityKeccak256(["string"], ["FAKE VOTING"]);
    await mineBlocks(35);
    const finishVotingAttempt = votings.connect(admin).finishVoting(FAKE_VOTING);
    await expect(finishVotingAttempt).to.be.revertedWith("There is no such active voting");

  });

  it("f4 Should try to finish voting twice and fail", async function () {

    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const secondFinishVotingAttempt = votings.connect(admin).finishVoting(TEST_VOTING);
    await expect(secondFinishVotingAttempt).to.be.revertedWith("Voting is already finished");

  });
});


describe("Votings (8 participants): finish", function () {
  let votings;
  let owner;
  let admin;
  let participants = [];
  let voters = [];
  let TEST_VOTING;
  let vote;

  beforeEach(async () => {
    const Votings = await ethers.getContractFactory("Votings");
    votings = await Votings.deploy(duration);
    await votings.deployed();
    const ADMIN = ethers.utils.solidityKeccak256(["string"], ["VOTING_ADMIN_ROLE"]);
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    admin = accounts[1];
    participants = accounts.slice(2, 10);
    voters = accounts.slice(10);
    await votings.grantRole(ADMIN, admin.address);

    TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    await votings.connect(admin).startVoting(TEST_VOTING, [
      participants[0].address,
      participants[1].address,
      participants[2].address,
      participants[3].address,
      participants[4].address,
      participants[5].address,
      participants[6].address,
      participants[7].address,
    ]);
    vote = (participant, voter) => (
      votings.connect(voter).vote(TEST_VOTING, participant.address, {
        value: ethers.utils.parseEther("0.01")
      })
    );
  });

  it("f2c: Should vote and finish voting (15 votes, 7 winners), check for the rest", async function () {
    // console.log(participants[7], voters[14]);
    await vote(participants[0], voters[0]);
    await vote(participants[0], voters[1]);

    await vote(participants[1], voters[2]);
    await vote(participants[1], voters[3]);

    await vote(participants[2], voters[4]);
    await vote(participants[2], voters[5]);

    await vote(participants[3], voters[6]);
    await vote(participants[3], voters[7]);

    await vote(participants[4], voters[8]);
    await vote(participants[4], voters[9]);

    await vote(participants[5], voters[10]);
    await vote(participants[5], voters[11]);

    await vote(participants[6], voters[12]);
    await vote(participants[6], voters[13]);

    await vote(participants[7], voters[14]);

    const provider = ethers.provider;
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const feeAmount = await votings.getFeeAmount();

    expect(feeAmount).to.be.equal(ethers.utils.parseEther("0.015000000000000005")); // (15 votes * 0.09 ether (prize)) % 7 (winners) = 5 (rest)
  });
});

describe("Votings (2 participants): withdraw", function () {
  let votings;
  let owner;
  let admin;
  let participants = [];
  let voters = [];
  let TEST_VOTING;

  beforeEach(async () => {
    const Votings = await ethers.getContractFactory("Votings");
    votings = await Votings.deploy(duration);
    await votings.deployed();
    const ADMIN = ethers.utils.solidityKeccak256(["string"], ["VOTING_ADMIN_ROLE"]);
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    admin = accounts[1];
    participants = accounts.slice(2, 4);
    voters = accounts.slice(4);
    await votings.grantRole(ADMIN, admin.address);

    TEST_VOTING = ethers.utils.solidityKeccak256(["string"], ["TEST VOTING"]);
    await votings.connect(admin).startVoting(TEST_VOTING, [participants[0].address, participants[1].address]);
  });

  it("w1: Should withdraw fee after finish voting", async function () {

    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });

    const provider = ethers.provider;
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const feeAmount = await votings.getFeeAmount();
    const balanceBefore = await provider.getBalance(owner.address);
    const tx = await votings.connect(owner).withdraw();
    const { gasPrice } = tx;
    const { gasUsed } = await tx.wait();
    const balanceAfter = await provider.getBalance(owner.address);

    expect(balanceAfter.add(gasUsed.mul(gasPrice)).sub(balanceBefore).eq(feeAmount)).to.be.true;
  });

  it("w2: Should try to withdraw fee without voting and fail", async function () {

    const provider = ethers.provider;
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const withdrawAttempt = votings.connect(owner).withdraw();

    await expect(withdrawAttempt).to.be.revertedWith("There is nothing to withdraw");
  });

  it("w3: Should try to withdraw with non-owner account and fail", async function () {

    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });

    const provider = ethers.provider;
    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    const withdrawAttempt = votings.connect(admin).withdraw();

    await expect(withdrawAttempt).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("w4: Should try to withdraw twice and fail", async function () {

    await votings.connect(voters[0]).vote(TEST_VOTING, participants[0].address, {
      value: ethers.utils.parseEther("0.01")
    });

    await mineBlocks(35);
    await votings.connect(admin).finishVoting(TEST_VOTING);
    votings.connect(owner).withdraw();
    const secondWithdrawAttempt = votings.connect(owner).withdraw();

    await expect(secondWithdrawAttempt).to.be.revertedWith("There is nothing to withdraw");
  });

});
