/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class CarInsuarance extends Contract {

    constructor() {
        super();
        this.nextClaimNumber = 1;
    }

    async registerCar(ctx, carNumber, make, model, color, owner) {
        const userType = await this.getCurrentUserType(ctx);

        if (userType != "INSUARANCE_OFFICER") {
            throw new Error(`This user does not have access to register a car. Current UserType ${userType}`);
        }
        const car = {
            carNumber,
            color,
            docType: 'car',
            make,
            model,
            owner,
        };

        await ctx.stub.putState(`CAR-${carNumber}`, Buffer.from(JSON.stringify(car)));
    }

    async submitClaim(ctx, carNumber, accidentInfo) {
        const carAsBytes = await ctx.stub.getState(`CAR-${carNumber}`); // get the car from chaincode state
        if (!carAsBytes || carAsBytes.length === 0) {
            throw new Error(`${carNumber} does not exist`);
        }
        const car = JSON.parse(carAsBytes.toString());
        const userId = await this.getCurrentUserId(ctx);
        if (car.owner !== userId) {
            throw new Error(`The current user is not the owner of this car. Current User ${userId}`);
        }

        const claimNumber = this.nextClaimNumber++;
        const claim = {
            claimNumber: claimNumber,
            docType: 'claim',
            carNumber: carNumber,
            createdDate: new Date(),
            accidentInfo: accidentInfo,
            isInvestigationPass: false,
            isApproved: false,
            totalDamage: 0,
            notes: []
        }
        await ctx.stub.putState(`CLAIM-${claimNumber}`, Buffer.from(JSON.stringify(claim)));
        return claimNumber;
    }

    async investigateClaim(ctx, carNumber, claimNumber, isInvestigationPass, notes) {
        const userType = await this.getCurrentUserType(ctx);

        if (userType != "POLICE_OFFICER") {
            throw new Error(`This user does not have access to investigate claim. Current UserType ${userType}`);
        }

        const claimAsBytes = await ctx.stub.getState(`CLAIM-${claimNumber}`); // get the claim from chaincode state
        if (!claimAsBytes || claimAsBytes.length === 0) {
            throw new Error(`${claimNumber} does not exist`);
        }
        const claim = JSON.parse(claimAsBytes.toString());
        if (claim.carNumber !== carNumber) {
            throw new Error(`The car number is not matching. Current ${carNumber}`);
        }
        claim.isInvestigationPass = isInvestigationPass;
        claim.notes.push(notes);
        await ctx.stub.putState(`CLAIM-${claimNumber}`, Buffer.from(JSON.stringify(claim)));
    }

    async evaluateDamage(ctx, carNumber, claimNumber, totalDamage, notes) {
        const userType = await this.getCurrentUserType(ctx);

        if (userType != "DAMAGE_INSPECTOR") {
            throw new Error(`This user does not have access to evaluate damage. Current UserType ${userType}`);
        }

        const claimAsBytes = await ctx.stub.getState(`CLAIM-${claimNumber}`); // get the claim from chaincode state
        if (!claimAsBytes || claimAsBytes.length === 0) {
            throw new Error(`${claimNumber} does not exist`);
        }
        const claim = JSON.parse(claimAsBytes.toString());
        if (claim.carNumber !== carNumber) {
            throw new Error(`The car number is not matching. Current ${carNumber}`);
        }
        claim.totalDamage = totalDamage;
        claim.notes.push(notes);
        await ctx.stub.putState(`CLAIM-${claimNumber}`, Buffer.from(JSON.stringify(claim)));
    }

    async claimApproval(ctx, carNumber, claimNumber, notes) {
        const userType = await this.getCurrentUserType(ctx);

        if (userType != "INSUARANCE_OFFICER") {
            throw new Error(`This user does not have access to Claim Approval. Current UserType ${userType}`);
        }

        const claimAsBytes = await ctx.stub.getState(`CLAIM-${claimNumber}`); // get the claim from chaincode state
        if (!claimAsBytes || claimAsBytes.length === 0) {
            throw new Error(`${claimNumber} does not exist`);
        }
        const claim = JSON.parse(claimAsBytes.toString());
        if (claim.carNumber !== carNumber) {
            throw new Error(`The car number is not matching. Current ${carNumber}`);
        }

        if (claim.isInvestigationPass && claim.totalDamage > 0) {
            claim.isApproved = true;
            claim.notes.push(notes);
            await ctx.stub.putState(`CLAIM-${claimNumber}`, Buffer.from(JSON.stringify(claim)));
        } else {
            throw new Error(`The claim is not ready for approval ${claimNumber}`);
        }
    }

    async queryCar(ctx, carNumber) {
        const carAsBytes = await ctx.stub.getState(`CAR-${carNumber}`); // get the car from chaincode state
        if (!carAsBytes || carAsBytes.length === 0) {
            throw new Error(`${carNumber} does not exist`);
        }
        console.log(carAsBytes.toString());
        return carAsBytes.toString();
    }

    async queryClaim(ctx, claimNumber) {
        const claimAsBytes = await ctx.stub.getState(`CLAIM-${claimNumber}`); // get the claim from chaincode state
        if (!claimAsBytes || claimAsBytes.length === 0) {
            throw new Error(`${claimNumber} does not exist`);
        }
        console.log(claimAsBytes.toString());
        return claimAsBytes.toString();
    }

    /**
      * getCurrentUserType
      * To be called by application to get the type for a user who is logged in
      *
      * @param {Context} ctx the transaction context
      * Usage:  getCurrentUserType ()
     */
    async getCurrentUserType(ctx) {
        return ctx.clientIdentity.getAttributeValue("usertype");
    }

    /**
      * getCurrentUserId
      * To be called by application to get the type for a user who is logged in
      *
      * @param {Context} ctx the transaction context
      * Usage:  getCurrentUserId ()
     */
    async getCurrentUserId(ctx) {
        let id = [];
        id.push(ctx.clientIdentity.getID());
        var begin = id[0].indexOf("/CN=");
        var end = id[0].lastIndexOf("::/C=");
        let userid = id[0].substring(begin + 4, end);
        return userid;
    }
}

module.exports = CarInsuarance;
