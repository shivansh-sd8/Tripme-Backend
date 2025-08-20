const User = require('../models/User');
const KycVerification = require('../models/KycVerification');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/sendEmail');

// @desc    Submit KYC documents
// @route   POST /api/kyc/submit
// @access  Private
const submitKYC = async (req, res) => {
  try {
    const {
      identityDocument,
      documentNumber,
      documentImage,
      addressProof,
      addressProofImage,
      selfie
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if KYC is already submitted and pending
    if (user.kyc && user.kyc.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'KYC application is already under review'
      });
    }

    // Check if KYC is already verified
    if (user.kyc && user.kyc.status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'KYC is already verified'
      });
    }

    // Validate required fields
    if (!identityDocument || !documentNumber || !documentImage) {
      return res.status(400).json({
        success: false,
        message: 'Identity document details are required'
      });
    }

    if (!addressProof || !addressProofImage) {
      return res.status(400).json({
        success: false,
        message: 'Address proof is required'
      });
    }

    if (!selfie) {
      return res.status(400).json({
        success: false,
        message: 'Selfie is required'
      });
    }

    // Create or update KYC verification record
    const kycData = {
      user: user._id,
      identityDocument: {
        type: identityDocument,
        number: documentNumber,
        frontImage: documentImage,
        backImage: documentImage, // For now, using same image for both sides
        expiryDate: null // Can be added later
      },
      addressProof: {
        type: addressProof,
        documentImage: addressProofImage,
        address: user.location || {}
      },
      selfie: selfie,
      status: 'pending'
    };

    // Update user's KYC status
    user.kyc = {
      identityDocument,
      documentNumber,
      documentImage,
      status: 'pending'
    };

    await user.save();

    // Create KYC verification record
    await KycVerification.findOneAndUpdate(
      { user: user._id },
      kycData,
      { upsert: true, new: true }
    );

    // Create notification for admin (if admin notification system exists)
    // This will be handled by the admin dashboard

    res.status(200).json({
      success: true,
      message: 'KYC documents submitted successfully. Please wait for verification.',
      data: { 
        kyc: user.kyc,
        nextStep: 'wait_for_approval'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting KYC',
      error: error.message
    });
  }
};

// @desc    Get KYC status
// @route   GET /api/kyc/status
// @access  Private
const getKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const kycVerification = await KycVerification.findOne({ user: user._id });

    res.status(200).json({
      success: true,
      data: {
        kyc: user.kyc,
        verification: kycVerification,
        canBecomeHost: user.kyc?.status === 'verified'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC status',
      error: error.message
    });
  }
};

// @desc    Update KYC documents
// @route   PUT /api/kyc/update
// @access  Private
const updateKYC = async (req, res) => {
  try {
    const {
      identityDocument,
      documentNumber,
      documentImage,
      addressProof,
      addressProofImage,
      selfie
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if KYC is pending (can't update while under review)
    if (user.kyc && user.kyc.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update KYC while application is under review'
      });
    }

    // Check if KYC is verified (can't update verified KYC)
    if (user.kyc && user.kyc.status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update verified KYC'
      });
    }

    // Update user's KYC information
    if (identityDocument) user.kyc.identityDocument = identityDocument;
    if (documentNumber) user.kyc.documentNumber = documentNumber;
    if (documentImage) user.kyc.documentImage = documentImage;
    
    // Reset status to pending for new submission
    user.kyc.status = 'pending';

    await user.save();

    // Update KYC verification record
    const kycData = {
      user: user._id,
      status: 'pending'
    };

    if (identityDocument) kycData.identityDocument = { type: identityDocument };
    if (documentNumber) kycData.identityDocument = { ...kycData.identityDocument, number: documentNumber };
    if (documentImage) kycData.identityDocument = { ...kycData.identityDocument, frontImage: documentImage };
    if (addressProof) kycData.addressProof = { type: addressProof };
    if (addressProofImage) kycData.addressProof = { ...kycData.addressProof, documentImage: addressProofImage };
    if (selfie) kycData.selfie = selfie;

    await KycVerification.findOneAndUpdate(
      { user: user._id },
      kycData,
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'KYC documents updated successfully. Please wait for verification.',
      data: { 
        kyc: user.kyc,
        nextStep: 'wait_for_approval'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating KYC',
      error: error.message
    });
  }
};

// @desc    Get KYC requirements
// @route   GET /api/kyc/requirements
// @access  Public
const getKYCRequirements = async (req, res) => {
  try {
    const requirements = {
      identityDocuments: [
        {
          type: 'passport',
          name: 'Passport',
          description: 'Valid passport with clear photo and details'
        },
        {
          type: 'national-id',
          name: 'National ID Card',
          description: 'Government-issued national identification card'
        },
        {
          type: 'drivers-license',
          name: 'Driver\'s License',
          description: 'Valid driver\'s license with photo'
        },
        {
          type: 'aadhar-card',
          name: 'Aadhar Card',
          description: 'Indian Aadhar card with photo'
        }
      ],
      addressProofs: [
        {
          type: 'utility-bill',
          name: 'Utility Bill',
          description: 'Recent electricity, water, or gas bill (not older than 3 months)'
        },
        {
          type: 'bank-statement',
          name: 'Bank Statement',
          description: 'Recent bank statement with address (not older than 3 months)'
        },
        {
          type: 'rental-agreement',
          name: 'Rental Agreement',
          description: 'Current rental or lease agreement'
        },
        {
          type: 'property-tax',
          name: 'Property Tax Receipt',
          description: 'Property tax receipt or assessment'
        }
      ],
      selfie: {
        description: 'Clear selfie photo holding your ID document',
        requirements: [
          'Face should be clearly visible',
          'ID document should be readable',
          'Good lighting conditions',
          'No filters or editing'
        ]
      },
      generalRequirements: [
        'All documents must be in English or have English translations',
        'Documents must be valid and not expired',
        'Photos must be clear and legible',
        'All personal information must match across documents'
      ]
    };

    res.status(200).json({
      success: true,
      data: { requirements }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC requirements',
      error: error.message
    });
  }
};

// @desc    Verify KYC (Admin only)
// @route   PUT /api/kyc/:userId/verify
// @access  Private (Admin only)
const verifyKYC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, rejectionReason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.kyc || user.kyc.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending KYC application found'
      });
    }

    // Update KYC status
    user.kyc.status = status;
    if (status === 'rejected' && rejectionReason) {
      user.kyc.rejectionReason = rejectionReason;
    }

    // If approved, mark user as verified
    if (status === 'verified') {
      user.isVerified = true;
    }

    await user.save();

    // Update KYC verification record
    await KycVerification.findOneAndUpdate(
      { user: user._id },
      { 
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined,
        verifiedBy: req.user.id,
        verifiedAt: new Date()
      }
    );

    // Create notification for user
    await Notification.create({
      user: user._id,
      type: 'kyc',
      title: `KYC ${status === 'verified' ? 'Approved' : 'Rejected'}`,
      message: status === 'verified' 
        ? 'Your KYC has been approved! You can now apply to become a host.'
        : `Your KYC has been rejected. Reason: ${rejectionReason}`,
      metadata: { kycStatus: status }
    });

    // Send email notification
    const emailSubject = status === 'verified' ? 'KYC Approved' : 'KYC Rejected';
    const emailMessage = status === 'verified'
      ? 'Congratulations! Your KYC has been approved. You can now apply to become a host and start creating listings and services.'
      : `Your KYC application has been rejected. Reason: ${rejectionReason}. Please submit new documents and try again.`;

    await sendEmail(user.email, emailSubject, emailMessage);

    res.status(200).json({
      success: true,
      message: `KYC ${status === 'verified' ? 'approved' : 'rejected'} successfully`,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying KYC',
      error: error.message
    });
  }
};

module.exports = {
  submitKYC,
  getKYCStatus,
  updateKYC,
  getKYCRequirements,
  verifyKYC
}; 